import { Request, Response } from 'express'
import {
  createSalesInvoice,
  deleteSalesInvoice,
  getSalesInvoiceById,
  listSalesInvoices,
  updateSalesInvoice,
  updatePaymentStatus,
} from '../services/salesInvoiceService'
import { getSettings } from '../services/settingsService'
import { buildInvoiceQrContent, generateInvoiceQrCode } from '../utils/qrCodeGenerator'
import { recordStockMovement, getCOGSForSale, getInventoryById, reverseInventoryTransactions } from '../services/inventoryService'
import { hasDeliveryOrdersForInvoice } from '../services/deliveryOrderService'
import { createReceivable, recordPayment, updateReceivable, deleteReceivable } from '../services/receivableService'
import { createJournalEntry, getJournalEntriesByReference, deleteJournalEntry } from '../services/journalEntryService'
import SalesInvoice from '../models/SalesInvoice'
import crypto from 'crypto'
import { getPaymentAccountMapping, calculateBankCharges, formatJournalDescriptionWithBankCharges } from '../utils/paymentMethodMapper'

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const mongoose = await import('mongoose')
    const body: any = req.body || {}
    const rawCustomerId = body.customer_id || body.customer
    const customerId = typeof rawCustomerId === 'string'
      ? rawCustomerId.trim()
      : rawCustomerId?._id?.toString?.() || ''

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer is required' })
    }

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' })
    }

    req.body = { ...body, customer_id: customerId }

    const userId = (req as any).user?.id
    const invoice = await createSalesInvoice(req.body, userId)
    
    // Update inventory quantities and calculate COGS after successful invoice creation
    let totalCOGS = 0
    if (invoice.line_items && invoice.line_items.length > 0) {
      for (const lineItem of invoice.line_items) {
        const productId = typeof lineItem.product === 'string' 
          ? lineItem.product 
          : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
        
        if (!productId) continue

        const inventoryItem = await getInventoryById(productId)
        if (!inventoryItem) continue

        // Allow overselling: always record sale movement even if available qty becomes negative.
        try {
          const cogs = await getCOGSForSale(productId, lineItem.quantity)
          totalCOGS += cogs.total_cost

          await recordStockMovement({
            product_id: productId,
            type: 'sale',
            reference: invoice.invoice_number,
            reference_id: (invoice._id as any)?.toString() || String(invoice._id),
            quantity: lineItem.quantity,
            unit_cost: cogs.unit_cost,
            date: invoice.invoice_date,
            notes: `Sale from ${invoice.invoice_number}`,
            createdBy: userId,
            createJournalEntry: false,
          })
        } catch (stockError: any) {
          console.error(`Error recording stock movement for product ${productId}:`, stockError)
          // Continue with other products even if one fails
        }
      }
    }

    // Determine if this is a cash sale or credit sale
    // Normalize payment status for case-insensitive comparison
    const paymentStatus = invoice.payment_status?.toLowerCase() || 'unpaid'
    const isPaid = paymentStatus === 'paid'
    const isCashSale = isPaid && invoice.payment_method
    const isCreditSale = !isPaid && (paymentStatus === 'unpaid' || paymentStatus === 'partial')
    
    // Ensure payment_status is normalized to lowercase 'paid' if it matches
    if (isPaid && invoice.payment_status !== 'paid') {
      invoice.payment_status = 'paid' as any
      invoice.balance_due = 0
      await invoice.save()
    }

    // Accounting Logic
    // Handle paid invoices (with or without payment method)
    if (isPaid) {
      // If payment_method is provided, treat as cash sale with journal entries
      if (invoice.payment_method) {
      // Paid Cash Sale: 
      // (a) Revenue Entry: Debit Cash/Bank, Credit Sales Revenue
      // (b) COGS Entry: Debit COGS, Credit Inventory
      // (c) Create Receivable with paid status and payment record
      try {
        if (userId) {
          // Get payment account mapping
          const paymentMapping = getPaymentAccountMapping(invoice.payment_method)
          
          // Calculate bank charges for card payments
          let bankCharges = 0
          let description = `Cash Sale - Invoice: ${invoice.invoice_number}${invoice.reference_number ? ` (Ref: ${invoice.reference_number})` : ''}`
          
          if (paymentMapping.bankChargesPercentage) {
            bankCharges = calculateBankCharges(invoice.total_amount, paymentMapping.bankChargesPercentage)
            description = formatJournalDescriptionWithBankCharges(invoice.total_amount, bankCharges, description)
          }
          
          // Revenue Entry
          // Note: Bank charges are shown in description but NOT added to the amounts
          // The debit/credit amounts remain the same as the invoice total_amount
          await createJournalEntry({
            date: invoice.invoice_date,
            reference: invoice.invoice_number,
            description,
            entries: [
              {
                account_id: paymentMapping.account_id,
                account_name: paymentMapping.account_name,
                debit: invoice.total_amount,
                credit: 0,
              },
              {
                account_id: 'SALES_REVENUE',
                account_name: 'Sales Revenue',
                debit: 0,
                credit: invoice.total_amount,
              },
            ],
            createdBy: userId,
            source_module: 'sales_invoice',
            // Legacy fields for backward compatibility
            referenceType: 'Sales',
            referenceId: String(invoice._id),
          })
          console.log(`Journal entry created for paid sales invoice ${invoice.invoice_number} (Revenue)`)

          // Create Receivable with paid status and payment record
          const customerId = typeof invoice.customer_id === 'string' 
            ? invoice.customer_id 
            : (invoice.customer_id as any)?._id?.toString() || (invoice.customer_id as any)?.id?.toString()
          
          if (customerId) {
            try {
              const receivable = await createReceivable({
                customer_id: customerId,
                invoice_number: invoice.invoice_number,
                invoice_date: invoice.invoice_date,
                due_date: invoice.due_date,
                total_amount: invoice.total_amount,
                tax_amount: invoice.tax_amount,
                currency: invoice.currency,
                payment_terms: invoice.payment_terms,
                notes: invoice.notes || `Sales Invoice: ${invoice.invoice_number}`,
                isPaid: true,
                paymentMethod: invoice.payment_method,
                paymentDate: invoice.invoice_date,
                paymentReference: invoice.reference_number,
                skipJournalEntry: true, // Skip journal entry since we already created it above
              }, userId)

              // Link invoice to receivable
              if (receivable) {
                invoice.receivable_id = receivable._id as any
                // Ensure payment_status remains 'paid'
                invoice.payment_status = 'paid'
                invoice.balance_due = 0
                await invoice.save()
                console.log(`Receivable created with paid status for invoice ${invoice.invoice_number}`)
              }
            } catch (receivableError: any) {
              console.error('Error creating paid receivable entry:', receivableError)
              // Continue - invoice is already created with paid status
            }
          }
        }
      } catch (journalError: any) {
        console.error('Error creating journal entry for cash sale:', journalError)
        console.error('Error details:', journalError.message, journalError.stack)
      }
      } else {
        // Paid invoice without payment method - just ensure status is preserved
        invoice.payment_status = 'paid' as any
        invoice.balance_due = 0
        await invoice.save()
        console.log(`Paid invoice ${invoice.invoice_number} created without payment method`)
      }
    } else if (isCreditSale) {
      // Credit Sale: Create Receivable, Debit Accounts Receivable, Credit Sales Revenue
      try {
        const customerId = typeof invoice.customer_id === 'string' 
          ? invoice.customer_id 
          : (invoice.customer_id as any)?._id?.toString() || (invoice.customer_id as any)?.id?.toString()
        
        if (customerId && userId) {
          // Create Receivable entry (unpaid)
          const receivable = await createReceivable({
            customer_id: customerId,
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            total_amount: invoice.total_amount,
            tax_amount: invoice.tax_amount,
            currency: invoice.currency,
            payment_terms: invoice.payment_terms,
            notes: invoice.notes || `Sales Invoice: ${invoice.invoice_number}`,
            isPaid: false,
            skipJournalEntry: false, // Let receivable service create journal entry
          }, userId)

          // Link invoice to receivable
          if (receivable) {
            invoice.receivable_id = receivable._id as any
            // Preserve payment_status - don't override if it's already set to 'paid'
            if (invoice.payment_status !== 'paid') {
              invoice.payment_status = invoice.payment_status || 'unpaid'
            }
            await invoice.save()
          }

          // Journal entry for revenue is created by createReceivable service
        }
      } catch (receivableError: any) {
        console.error('Error creating receivable entry:', receivableError)
        // Don't change payment_status - preserve what was sent
      }
    }
    
    // Refresh invoice from database to ensure we return the latest state
    const updatedInvoice = await getSalesInvoiceById(String(invoice._id))
    
    res.status(201).json({ success: true, data: updatedInvoice || invoice })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await listSalesInvoices({
      q: req.query.q as string,
      customer_id: req.query.customer_id as string,
      payment_status: req.query.payment_status as string,
      from: req.query.from as string,
      to: req.query.to as string,
    })
    res.json({ success: true, data: invoices })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getInvoice = async (req: Request, res: Response) => {
  try {
    const invoice = await getSalesInvoiceById(req.params.id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }
    res.json({ success: true, data: invoice })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getInvoiceQrCode = async (req: Request, res: Response) => {
  try {
    const invoice = await getSalesInvoiceById(req.params.id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }
    const settings = await getSettings()
    const sellerName = settings?.businessInformation?.companyName || 'Company'
    const trn = invoice.trn || settings?.taxInformation?.trn || ''
    const invoiceDate = new Date(invoice.invoice_date).toISOString().split('T')[0]
    const totalAmount = invoice.total_amount ?? 0
    const vatAmount = invoice.tax_amount ?? (invoice as any).vat ?? 0

    const qrContent = buildInvoiceQrContent({
      sellerName,
      trn,
      invoiceNumber: invoice.invoice_number,
      invoiceDate,
      totalAmount,
      vatAmount,
    })
    const qrImage = await generateInvoiceQrCode(qrContent)

    res.json({ success: true, data: { qrData: qrContent, qrImage } })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    
    // Get existing invoice before update to find journal entries
    const existingInvoice = await getSalesInvoiceById(req.params.id)
    if (!existingInvoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    // Get invoice ID as string - ensure we extract just the ID, not the whole object
    // Use req.params.id directly as it's the most reliable source
    const invoiceId = req.params.id
    
    // Validate that invoiceId is a valid ObjectId format
    const mongoose = await import('mongoose')
    if (!mongoose.Types.ObjectId.isValid(invoiceId) || invoiceId.length !== 24) {
      console.error('Invalid invoiceId format:', invoiceId)
      return res.status(400).json({ success: false, message: 'Invalid invoice ID format' })
    }

    // Reverse inventory transactions before updating (restore quantities)
    try {
      await reverseInventoryTransactions(existingInvoice.invoice_number, invoiceId)
    } catch (inventoryError: any) {
      console.error('Error reversing inventory transactions for update:', inventoryError)
      // Continue with update even if inventory reversal fails
    }

    // Find and delete all related journal entries before updating
    if (invoiceId) {
      try {
        // Ensure invoiceId is a valid string (not an object)
        const validInvoiceId = typeof invoiceId === 'string' && invoiceId.length === 24 
          ? invoiceId 
          : String(invoiceId)
        
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Sales', validInvoiceId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'sales_invoice',
          reference: existingInvoice.invoice_number,
        }).exec()

        // Also find journal entries created by receivable service
        // If invoice has a receivable_id, find journal entries for that receivable
        let journalEntriesByReceivable: any[] = []
        if (existingInvoice.receivable_id) {
          // Properly extract receivable ID (handle both string and populated object)
          let receivableId: string
          const receivableRef = existingInvoice.receivable_id as any
          if (typeof receivableRef === 'string') {
            receivableId = receivableRef
          } else if (receivableRef && typeof receivableRef === 'object') {
            // Handle populated object
            if (receivableRef.id !== undefined) {
              receivableId = String(receivableRef.id)
            } else if (receivableRef._id) {
              receivableId = typeof receivableRef._id === 'string' 
                ? receivableRef._id 
                : String(receivableRef._id)
            } else {
              receivableId = String(receivableRef)
            }
          } else {
            receivableId = String(receivableRef)
          }
          
          // Validate receivableId is a valid ObjectId format
          const mongoose = await import('mongoose')
          if (mongoose.Types.ObjectId.isValid(receivableId) && receivableId.length === 24) {
            journalEntriesByReceivable = await JournalEntry.find({
              $or: [
                { referenceType: 'Receivable', referenceId: receivableId },
                { source_module: 'receivable', reference: existingInvoice.invoice_number },
              ]
            }).exec()
          }
        }

        // Combine and deduplicate journal entries
        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesBySource.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesByReceivable.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for sales invoice update:', journalError)
        // Continue with invoice update even if journal entry deletion fails
      }
    }

    // Update the invoice
    const invoice = await updateSalesInvoice(req.params.id, req.body)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    // Update linked receivable if it exists
    if (invoice.receivable_id) {
      try {
        const receivableId = typeof invoice.receivable_id === 'string' 
          ? invoice.receivable_id 
          : (invoice.receivable_id as any)?._id?.toString() || String(invoice.receivable_id)
        
        if (receivableId) {
          const updatedReceivable = await updateReceivable(receivableId, {
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.invoice_date,
            due_date: invoice.due_date,
            total_amount: invoice.total_amount,
            skipJournalEntry: true, // Journal entries are handled by invoice update
            userId: userId, // Pass userId for journal entry recreation if needed
          } as any)
          
          // Sync sales invoice payment_status and balance_due with receivable
          if (updatedReceivable) {
            invoice.payment_status = updatedReceivable.status as any
            invoice.balance_due = updatedReceivable.balance_due
            await invoice.save()
          }
        }
      } catch (receivableError: any) {
        console.error('Error updating linked receivable:', receivableError)
        // Continue even if receivable update fails
      }
    }

    // Recreate inventory transactions and journal entries based on updated invoice data
    if (userId) {
      try {
        // Record new inventory transactions for updated invoice
        if (invoice.line_items && invoice.line_items.length > 0) {
          for (const lineItem of invoice.line_items) {
            const productId = typeof lineItem.product === 'string' 
              ? lineItem.product 
              : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
            
            if (!productId) continue

            const inventoryItem = await getInventoryById(productId)
            if (!inventoryItem) continue

            // Allow overselling: always record sale movement even if available qty becomes negative.
            try {
              const cogs = await getCOGSForSale(productId, lineItem.quantity)

              await recordStockMovement({
                product_id: productId,
                type: 'sale',
                reference: invoice.invoice_number,
                reference_id: invoiceId,
                quantity: lineItem.quantity,
                unit_cost: cogs.unit_cost,
                date: invoice.invoice_date,
                notes: `Sale from ${invoice.invoice_number}`,
                createdBy: userId,
                createJournalEntry: false,
              })
            } catch (stockError: any) {
              console.error(`Error recording stock movement for product ${productId}:`, stockError)
              // Continue with other products even if one fails
            }
          }
        }

        // Calculate COGS for updated invoice
        let totalCOGS = 0
        if (invoice.line_items && invoice.line_items.length > 0) {
          for (const lineItem of invoice.line_items) {
            const productId = typeof lineItem.product === 'string' 
              ? lineItem.product 
              : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
            
            if (!productId) continue

            try {
              const cogs = await getCOGSForSale(productId, lineItem.quantity)
              totalCOGS += cogs.total_cost
            } catch (cogsError: any) {
              console.error(`Error calculating COGS for product ${productId}:`, cogsError)
            }
          }
        }

        // Determine payment status
        const paymentStatus = invoice.payment_status?.toLowerCase() || 'unpaid'
        const isPaid = paymentStatus === 'paid'
        const isCashSale = isPaid && invoice.payment_method
        const isCreditSale = !isPaid && (paymentStatus === 'unpaid' || paymentStatus === 'partial')

        // Recreate journal entries based on payment status
        if (isPaid && isCashSale) {
          // Paid Cash Sale: Revenue Entry
          const paymentMapping = getPaymentAccountMapping(invoice.payment_method)
          
          // Calculate bank charges for card payments
          let bankCharges = 0
          let description = `Cash Sale - Invoice: ${invoice.invoice_number}${invoice.reference_number ? ` (Ref: ${invoice.reference_number})` : ''}`
          
          if (paymentMapping.bankChargesPercentage) {
            bankCharges = calculateBankCharges(invoice.total_amount, paymentMapping.bankChargesPercentage)
            description = formatJournalDescriptionWithBankCharges(invoice.total_amount, bankCharges, description)
          }
          
          await createJournalEntry({
            date: invoice.invoice_date,
            reference: invoice.invoice_number,
            description,
            entries: [
              {
                account_id: paymentMapping.account_id,
                account_name: paymentMapping.account_name,
                debit: invoice.total_amount,
                credit: 0,
              },
              {
                account_id: 'SALES_REVENUE',
                account_name: 'Sales Revenue',
                debit: 0,
                credit: invoice.total_amount,
              },
            ],
            createdBy: userId,
            source_module: 'sales_invoice',
            referenceType: 'Sales',
            referenceId: String(invoice._id),
          })
        } else if (isCreditSale) {
          // Credit Sale: Revenue entry is handled by receivable service
        }
      } catch (journalError: any) {
        console.error('Error recreating journal entries for sales invoice update:', journalError)
        // Continue even if journal entry recreation fails
      }
    }

    res.json({ success: true, data: invoice })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updatePaymentStatusHandler = async (req: Request, res: Response) => {
  try {
    const { payment_status } = req.body
    if (!payment_status || !['unpaid', 'partial', 'paid', 'overdue'].includes(payment_status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid payment_status. Must be "unpaid", "partial", "paid", or "overdue"' 
      })
    }
    const invoice = await updatePaymentStatus(req.params.id, payment_status)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }
    res.json({ success: true, data: invoice })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Apply payment to a credit sale invoice
export const applyPayment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const invoice = await getSalesInvoiceById(req.params.id)
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    // Check if invoice has a receivable (credit sale)
    if (!invoice.receivable_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'This invoice is not a credit sale. Payments can only be applied to credit sales.' 
      })
    }

    const { date, amount, payment_method, reference_number, notes } = req.body

    if (!date || !amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment date and amount are required. Amount must be greater than 0.' 
      })
    }

    // Extract receivable ID - handle both populated object and ObjectId
    // When populated, receivable_id is a Document with _id property
    // When not populated, it's an ObjectId
    // Use .id property (Mongoose getter) if available, otherwise extract _id or convert to string
    const receivableRef = invoice.receivable_id as any
    let receivableId: string
    
    if (receivableRef && typeof receivableRef === 'object') {
      // Check if it has .id property (Mongoose Document getter)
      if (receivableRef.id !== undefined) {
        receivableId = String(receivableRef.id)
      } 
      // Check if it's a populated document with _id
      else if (receivableRef._id && typeof receivableRef._id === 'object' && receivableRef._id.toString) {
        receivableId = receivableRef._id.toString()
      }
      // Check if it's an ObjectId with toString method
      else if (receivableRef.toString && typeof receivableRef.toString === 'function') {
        receivableId = receivableRef.toString()
      }
      // Fallback
      else {
        receivableId = String(receivableRef)
      }
    } else {
      receivableId = String(invoice.receivable_id)
    }

    // Record payment in Receivable
    const receivable = await recordPayment(
      receivableId,
      {
        date,
        amount,
        paymentMethod: payment_method,
        referenceNumber: reference_number,
        notes,
      },
      userId
    )

    if (!receivable) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to record payment in receivable' 
      })
    }

    // Update invoice balance_due and payment_status based on receivable
    invoice.balance_due = receivable.balance_due
    invoice.payment_status = receivable.status as any
    await invoice.save()

    res.json({ 
      success: true, 
      data: {
        invoice,
        receivable,
        message: 'Payment applied successfully',
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    // Get invoice before deletion to restore inventory
    const invoice = await getSalesInvoiceById(req.params.id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    // Get invoice ID as string - use req.params.id directly as it's the most reliable source
    const invoiceId = req.params.id
    
    // Validate that invoiceId is a valid ObjectId format
    const mongoose = await import('mongoose')
    if (!mongoose.Types.ObjectId.isValid(invoiceId) || invoiceId.length !== 24) {
      console.error('Invalid invoiceId format:', invoiceId)
      return res.status(400).json({ success: false, message: 'Invalid invoice ID format' })
    }

    // Find and delete all related journal entries
    // Journal entries are linked via referenceType: 'Sales' and referenceId: invoice._id
    // or via source_module: 'sales_invoice' and reference: invoice.invoice_number
    if (invoiceId) {
      try {
        // Ensure invoiceId is a valid string (not an object)
        const validInvoiceId = typeof invoiceId === 'string' && invoiceId.length === 24 
          ? invoiceId 
          : String(invoiceId)
        
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Sales', validInvoiceId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'sales_invoice',
          reference: invoice.invoice_number,
        }).exec()

        // Combine and deduplicate journal entries
        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesBySource.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for sales invoice:', journalError)
        // Continue with invoice deletion even if journal entry deletion fails
      }
    }

    // Check if there are any delivery orders for this invoice
    const hasDeliveryOrders = await hasDeliveryOrdersForInvoice(req.params.id)

    // Reverse inventory transactions (delete them and restore quantities)
    // This will properly update both quantity_on_hand and qty_sold
    if (!hasDeliveryOrders) {
      try {
        await reverseInventoryTransactions(invoice.invoice_number, invoiceId)
      } catch (inventoryError: any) {
        console.error('Error reversing inventory transactions:', inventoryError)
        // Continue with deletion even if inventory reversal fails
      }
    }

    // Delete linked receivable if it exists
    if (invoice.receivable_id) {
      try {
        // Properly extract receivable ID (handle both string and populated object)
        let receivableId: string
        const receivableRef = invoice.receivable_id as any
        if (typeof receivableRef === 'string') {
          receivableId = receivableRef
        } else if (receivableRef && typeof receivableRef === 'object') {
          // Handle populated object
          if (receivableRef.id !== undefined) {
            receivableId = String(receivableRef.id)
          } else if (receivableRef._id) {
            receivableId = typeof receivableRef._id === 'string' 
              ? receivableRef._id 
              : String(receivableRef._id)
          } else {
            receivableId = String(receivableRef)
          }
        } else {
          receivableId = String(receivableRef)
        }
        
        // Validate receivableId is a valid ObjectId format
        const mongoose = await import('mongoose')
        if (receivableId && mongoose.Types.ObjectId.isValid(receivableId) && receivableId.length === 24) {
          // Find and delete journal entries for receivable first
          const JournalEntry = (await import('../models/JournalEntry')).default
          const receivableJournalEntries = await JournalEntry.find({
            $or: [
              { referenceType: 'Receivable', referenceId: receivableId },
              { source_module: 'receivable', reference: invoice.invoice_number },
              { source_module: 'receivable_payment', reference: invoice.invoice_number },
            ]
          }).exec()

          for (const journalEntry of receivableJournalEntries) {
            await deleteJournalEntry(String(journalEntry._id))
          }

          // Delete the receivable
          await deleteReceivable(receivableId)
        }
      } catch (receivableError: any) {
        console.error('Error deleting linked receivable:', receivableError)
        // Continue with invoice deletion even if receivable deletion fails
      }
    }

    await deleteSalesInvoice(req.params.id)
    res.json({ success: true, data: invoice })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Store for share links: { token: { invoiceId, expiresAt, type: 'sales' | 'purchase' } }
const shareLinks = new Map<string, { invoiceId: string; expiresAt: number; type: 'sales' | 'purchase' }>()

// Cleanup expired links every hour
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of shareLinks.entries()) {
    if (data.expiresAt < now) {
      shareLinks.delete(token)
    }
  }
}, 60 * 60 * 1000) // 1 hour

// Generate shareable link for sales invoice
export const generateShareLink = async (req: Request, res: Response) => {
  try {
    const invoice = await getSalesInvoiceById(req.params.id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    
    shareLinks.set(token, { invoiceId: req.params.id, expiresAt, type: 'sales' })

    // Get base URL from request origin, environment variable, or default
    const origin = req.get('origin') || req.get('referer')?.split('/').slice(0, 3).join('/')
    const baseUrl = origin || process.env.FRONTEND_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/share/sales-invoice/${token}`

    res.json({
      success: true,
      data: {
        shareUrl,
        token,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Get invoice via share token (public access)
export const getInvoiceByShareToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const linkData = shareLinks.get(token)

    if (!linkData) {
      return res.status(404).json({ success: false, message: 'Share link not found or expired' })
    }

    if (Date.now() > linkData.expiresAt) {
      shareLinks.delete(token)
      return res.status(410).json({ success: false, message: 'Share link has expired' })
    }

    if (linkData.type !== 'sales') {
      return res.status(400).json({ success: false, message: 'Invalid share link type' })
    }

    const invoice = await getSalesInvoiceById(linkData.invoiceId)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    res.json({ success: true, data: invoice })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}
