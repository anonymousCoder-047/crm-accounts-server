import { Request, Response } from 'express'
import {
  createPurchaseInvoice,
  deletePurchaseInvoice,
  getPurchaseInvoiceById,
  listPurchaseInvoices,
  updatePurchaseInvoice,
  updatePaymentStatus,
} from '../services/purchaseInvoiceService'
import { buildInvoiceQrContent, generateInvoiceQrCode } from '../utils/qrCodeGenerator'
import { recordStockMovement, getInventoryById, normalizePendingPurchaseStatus, getCOGSForSale, reverseInventoryTransactions } from '../services/inventoryService'
import { getPendingSalesQtyForProduct } from '../services/salesInvoiceService'
import SalesInvoice from '../models/SalesInvoice'
import InventoryTransaction from '../models/InventoryTransaction'
import { createPayable, recordPayment, updatePayable, deletePayable } from '../services/payableService'
import { createJournalEntry, getJournalEntriesByReference, deleteJournalEntry } from '../services/journalEntryService'
import { getAccountByAccountId, listAccounts } from '../services/accountService'
import Account from '../models/Account'
import PurchaseInvoice from '../models/PurchaseInvoice'
import mongoose from 'mongoose'
import crypto from 'crypto'
import { getPaymentAccountMapping, calculateBankCharges, formatJournalDescriptionWithBankCharges } from '../utils/paymentMethodMapper'

/**
 * Resolve account name or ID to actual account_id from database
 */
async function resolveAccountId(accountNameOrId: string, accountType?: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'): Promise<string> {
  try {
    // First try to find by account_id (if it's already a valid account_id)
    const accountById = await Account.findOne({ account_id: accountNameOrId, is_active: true })
    if (accountById) {
      return accountById.account_id
    }

    // Try to find by account name (case-insensitive)
    let account = await Account.findOne({
      account_name: { $regex: new RegExp(`^${accountNameOrId}$`, 'i') },
      is_active: true,
    })

    // If not found and account type is provided, try by type
    if (!account && accountType) {
      const accounts = await listAccounts({ account_type: accountType, is_active: true })
      if (accounts.length > 0) {
        // Try to find by name match first
        const matched = accounts.find(acc => 
          acc.account_name.toLowerCase().includes(accountNameOrId.toLowerCase()) ||
          accountNameOrId.toLowerCase().includes(acc.account_name.toLowerCase())
        )
        // If matched, find the full document from database
        if (matched) {
          account = await Account.findOne({ account_id: matched.account_id, is_active: true })
        } else {
          // Use first account of this type as fallback
          account = await Account.findOne({ account_id: accounts[0].account_id, is_active: true })
        }
      }
    }

    if (account) {
      console.log(`Resolved account "${accountNameOrId}" to account_id: ${account.account_id}`)
      return account.account_id
    }

    // Fallback: return the original value (might be a valid account_id format)
    console.warn(`Could not resolve account "${accountNameOrId}" to database account_id, using as-is`)
    return accountNameOrId
  } catch (error: any) {
    console.error(`Error resolving account "${accountNameOrId}":`, error.message)
    return accountNameOrId // Fallback to original value
  }
}

export const createPurchase = async (req: Request, res: Response) => {
  try {
    let userId = (req as any).user?.id
    if (userId && typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
      userId = new mongoose.Types.ObjectId(userId).toString()
    }
    if (!userId) {
      console.warn('⚠️  Warning: userId is missing from request. Journal entries may not be created.')
    }
    console.log('Creating purchase invoice with data:', JSON.stringify(req.body, null, 2))
    console.log('User ID:', userId || 'NOT PROVIDED')
    
    const invoice = await createPurchaseInvoice(req.body, userId)
    console.log('Purchase invoice created successfully:', invoice._id)
    
    // Update inventory quantities after successful purchase invoice creation
    // Record stock movements for each line item
    if (invoice.line_items && invoice.line_items.length > 0) {
      for (const lineItem of invoice.line_items) {
        const productId = typeof lineItem.product === 'string' 
          ? lineItem.product 
          : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
        
        if (!productId) continue

        const inventoryItem = await getInventoryById(productId)
        if (!inventoryItem) continue

        // Use base unit cost from line item (excludes invoice-level VAT - VAT is not part of product cost for inventory)
        const unitCost = lineItem.unit_cost || (lineItem.total / lineItem.quantity) || inventoryItem.unit_cost

        // Record stock movement (purchase)
        try {
          await recordStockMovement({
            product_id: productId,
            type: 'purchase',
            reference: invoice.invoice_number,
            reference_id: (invoice._id as any)?.toString() || String(invoice._id),
            quantity: lineItem.quantity,
            unit_cost: unitCost,
            date: invoice.invoice_date,
            notes: `Purchase from ${invoice.invoice_number}`,
            createdBy: userId,
            createJournalEntry: false, // Journal entry created separately below
          })

          // After purchase, check if there are pending sales to fulfill
          const updatedInventory = await getInventoryById(productId)
          if (updatedInventory) {
            // Get all sales invoices for this product
            const salesInvoices = await SalesInvoice.find({
              'line_items.product': productId,
            }).sort({ createdAt: 1 })
            
            let availableStock = updatedInventory.quantity_on_hand || 0
            let hasPendingSales = false
            
            // Process each pending sale (sales without stock movements)
            for (const salesInvoice of salesInvoices) {
              for (const salesLineItem of salesInvoice.line_items) {
                const salesProductId = typeof salesLineItem.product === 'string' 
                  ? salesLineItem.product 
                  : (salesLineItem.product as any)?._id?.toString() || (salesLineItem.product as any)?.id?.toString()
                
                if (salesProductId === productId) {
                  // Check if stock movement already exists for this sale
                  const existingMovement = await InventoryTransaction.findOne({
                    product_id: productId,
                    reference_id: (salesInvoice._id as any)?.toString() || String(salesInvoice._id),
                    type: 'sale',
                  })
                  
                  if (!existingMovement) {
                    // No stock movement recorded yet - this is a pending sale
                    hasPendingSales = true
                    const saleQty = salesLineItem.quantity || 0
                    
                    // Only process if we have enough stock
                    if (availableStock >= saleQty) {
                      try {
                        // Calculate COGS for this sale
                        const cogs = await getCOGSForSale(productId, saleQty)
                        
                        // Record stock movement for the sale (subtracts quantity)
                        await recordStockMovement({
                          product_id: productId,
                          type: 'sale',
                          reference: salesInvoice.invoice_number,
                          reference_id: (salesInvoice._id as any)?.toString() || String(salesInvoice._id),
                          quantity: saleQty,
                          unit_cost: cogs.unit_cost,
                          date: salesInvoice.invoice_date,
                          notes: `Sale from ${salesInvoice.invoice_number} (fulfilled after purchase)`,
                          createdBy: userId,
                          createJournalEntry: false,
                        })
                        
                        // Update available stock after processing this sale
                        availableStock -= saleQty
                        console.log(`Fulfilled pending sale ${salesInvoice.invoice_number} for product ${productId}, remaining stock: ${availableStock}`)
                      } catch (saleError: any) {
                        console.error(`Error processing pending sale for product ${productId}:`, saleError)
                        // Continue with other sales even if one fails
                      }
                    } else {
                      console.log(`Insufficient stock to fulfill sale ${salesInvoice.invoice_number}. Available: ${availableStock}, Required: ${saleQty}`)
                    }
                  }
                }
              }
            }
            
            // Update status to normal if there are no more pending sales or if stock is sufficient
            if (updatedInventory.status === 'pending_purchase') {
              // Check if all pending sales have been fulfilled
              const currentInventory = await getInventoryById(productId)
              if (currentInventory) {
                const remainingPendingSales = await SalesInvoice.find({
                  'line_items.product': productId,
                }).sort({ createdAt: 1 })
                
                let hasUnfulfilledSales = false
                for (const salesInvoice of remainingPendingSales) {
                  for (const salesLineItem of salesInvoice.line_items) {
                    const salesProductId = typeof salesLineItem.product === 'string' 
                      ? salesLineItem.product 
                      : (salesLineItem.product as any)?._id?.toString() || (salesLineItem.product as any)?.id?.toString()
                    
                    if (salesProductId === productId) {
                      const existingMovement = await InventoryTransaction.findOne({
                        product_id: productId,
                        reference_id: (salesInvoice._id as any)?.toString() || String(salesInvoice._id),
                        type: 'sale',
                      })
                      
                      if (!existingMovement) {
                        hasUnfulfilledSales = true
                        break
                      }
                    }
                  }
                  if (hasUnfulfilledSales) break
                }
                
                // Only update status to normal if all pending sales are fulfilled
                if (!hasUnfulfilledSales && (currentInventory.quantity_on_hand || 0) >= 0) {
                  await normalizePendingPurchaseStatus(productId)
                  console.log(`Updated product ${productId} status from pending_purchase to normal`)
                }
              }
            }
          }
        } catch (stockError: any) {
          console.error(`Error recording stock movement for product ${productId}:`, stockError)
          // Continue with other products even if one fails
        }
      }
    }

    // Normalize payment status for case-insensitive comparison
    const paymentStatus = invoice.payment_status?.toLowerCase() || 'unpaid'
    const isPaid = paymentStatus === 'paid'
    const isCashPurchase = isPaid && invoice.payment_method
    const isCreditPurchase = !isPaid && (paymentStatus === 'unpaid' || paymentStatus === 'partial')
    
    // Ensure payment_status is normalized to lowercase 'paid' if it matches
    if (isPaid && invoice.payment_status !== 'paid') {
      invoice.payment_status = 'paid' as any
      invoice.balance_due = 0
      await invoice.save()
    }

    // Accounting Logic
    // Handle paid invoices (with or without payment method)
    if (isPaid) {
      // If payment_method is provided, treat as cash purchase with journal entries
      if (invoice.payment_method) {
      // Paid Purchase Invoice (Cash Purchase):
      // Debit Inventory, Credit Cash/Bank
      // Also create Payable with paid status and payment record
      try {
        if (userId) {
          const invoiceId = typeof invoice._id === 'string' 
            ? invoice._id 
            : (invoice._id as any)?.toString()
          
          if (invoiceId) {
            // Get payment account mapping
            const paymentMapping = getPaymentAccountMapping(invoice.payment_method)
            
            // Calculate bank charges for card payments
            let bankCharges = 0
            let description = `Purchase Invoice: ${invoice.invoice_number} (Cash Purchase)${invoice.reference_number ? ` (Ref: ${invoice.reference_number})` : ''}`
            
            if (paymentMapping.bankChargesPercentage) {
              bankCharges = calculateBankCharges(invoice.total_amount, paymentMapping.bankChargesPercentage)
              description = formatJournalDescriptionWithBankCharges(invoice.total_amount, bankCharges, description)
            }
            
            // Resolve account IDs from database
            const inventoryAccountId = await resolveAccountId('Inventory', 'Asset')
            const cashAccountId = await resolveAccountId(paymentMapping.account_name, 'Asset')
            
            console.log(`Creating journal entry for cash purchase invoice ${invoice.invoice_number}`)
            console.log(`  Inventory Account ID: ${inventoryAccountId}`)
            console.log(`  Cash Account ID: ${cashAccountId}`)
            
            // Note: Bank charges are shown in description but NOT added to the amounts
            // The debit/credit amounts remain the same as the invoice total_amount
            await createJournalEntry({
              date: invoice.invoice_date,
              reference: invoice.invoice_number,
              description,
              entries: [
                {
                  account_id: inventoryAccountId,
                  account_name: 'Inventory',
                  debit: invoice.total_amount,
                  credit: 0,
                },
                {
                  account_id: cashAccountId,
                  account_name: paymentMapping.account_name,
                  debit: 0,
                  credit: invoice.total_amount,
                },
              ],
              createdBy: userId,
              source_module: 'purchase_invoice',
              // Legacy fields for backward compatibility
              referenceType: 'Purchase',
              referenceId: invoiceId,
            })
            console.log(`✅ Journal entry created successfully for paid purchase invoice ${invoice.invoice_number}`)

            // Create Payable with paid status and payment record
            const vendorId = typeof invoice.vendor_id === 'string' 
              ? invoice.vendor_id 
              : (invoice.vendor_id as any)?._id?.toString() || (invoice.vendor_id as any)?.id?.toString()
            
            if (vendorId) {
              try {
                const payable = await createPayable({
                  vendor_id: vendorId,
                  bill_number: invoice.invoice_number,
                  bill_date: invoice.invoice_date,
                  due_date: invoice.due_date,
                  total_amount: invoice.total_amount,
                  tax_amount: invoice.tax_amount,
                  currency: invoice.currency,
                  payment_terms: invoice.payment_terms || 'Net 30',
                  notes: `Purchase Invoice: ${invoice.invoice_number}`,
                  isPaid: true,
                  paymentMethod: invoice.payment_method,
                  paymentDate: invoice.invoice_date,
                  paymentReference: invoice.reference_number,
                  skipJournalEntry: true, // Skip journal entry since we already created it above
                }, userId)

                // Link payable to invoice
                if (payable) {
                  const payableId = typeof payable._id === 'string' 
                    ? payable._id 
                    : (payable._id as any)?.toString()
                  
                  if (payableId) {
                    invoice.payable_id = payableId as any
                    // Ensure payment_status remains 'paid'
                    invoice.payment_status = 'paid'
                    invoice.balance_due = 0
                    await invoice.save()
                    console.log(`Payable created with paid status for invoice ${invoice.invoice_number}`)
                  }
                }
              } catch (payableError: any) {
                console.error('Error creating paid payable entry:', payableError)
                // Continue - invoice is already created with paid status
              }
            }
          }
        }
      } catch (journalError: any) {
        console.error(`❌ Error creating journal entry for cash purchase invoice ${invoice.invoice_number}:`, journalError)
        console.error(`   Error message: ${journalError.message}`)
        console.error(`   Error stack: ${journalError.stack}`)
        // Don't fail the invoice creation, but log the error clearly
      }
      } else {
        // Paid invoice without payment method - just ensure status is preserved
        invoice.payment_status = 'paid' as any
        invoice.balance_due = 0
        await invoice.save()
        console.log(`Paid purchase invoice ${invoice.invoice_number} created without payment method`)
      }
    } else if (isCreditPurchase) {
      // Unpaid Purchase Invoice (Credit Purchase):
      // Debit Inventory, Credit Accounts Payable
      // Create Payable record
      console.log(`Processing credit purchase invoice ${invoice.invoice_number}`)
      try {
        const vendorId = typeof invoice.vendor_id === 'string' 
          ? invoice.vendor_id 
          : (invoice.vendor_id as any)?._id?.toString() || (invoice.vendor_id as any)?.id?.toString()
        
        // Create Payable if vendorId exists
        if (vendorId) {
          try {
            // Create Payable (skip journal entry - we'll create it with INVENTORY account)
            const payable = await createPayable({
              vendor_id: vendorId,
              bill_number: invoice.invoice_number,
              bill_date: invoice.invoice_date,
              due_date: invoice.due_date,
              total_amount: invoice.total_amount,
              tax_amount: invoice.tax_amount,
              currency: invoice.currency,
              payment_terms: invoice.payment_terms || 'Net 30',
              notes: `Purchase Invoice: ${invoice.invoice_number}`,
              isPaid: false,
              skipJournalEntry: true, // Skip - we'll create journal entry with INVENTORY account below
            }, userId)

            // Link payable to invoice
            if (payable) {
              const payableId = typeof payable._id === 'string' 
                ? payable._id 
                : (payable._id as any)?.toString()
              
              if (payableId) {
                invoice.payable_id = payableId as any
                // Preserve payment_status - don't override if it's already set to 'paid'
                if (invoice.payment_status !== 'paid') {
                  invoice.payment_status = invoice.payment_status || 'unpaid'
                }
                await invoice.save()
                console.log(`✅ Payable created and linked to invoice ${invoice.invoice_number}`)
              }
            }
          } catch (payableError: any) {
            console.error(`❌ Error creating payable entry for invoice ${invoice.invoice_number}:`, payableError)
            console.error(`   Error message: ${payableError.message}`)
            console.error(`   Error stack: ${payableError.stack}`)
            // Continue - we'll still create the journal entry
          }
        } else {
          console.warn(`⚠️  Vendor ID missing for invoice ${invoice.invoice_number}, skipping payable creation`)
        }

        // Create Journal Entry: Debit Inventory, Credit Accounts Payable
        // This should happen regardless of whether payable was created
        if (userId) {
          const invoiceId = typeof invoice._id === 'string' 
            ? invoice._id 
            : (invoice._id as any)?.toString()
          
          if (invoiceId) {
            // Resolve account IDs from database
            const inventoryAccountId = await resolveAccountId('Inventory', 'Asset')
            const accountsPayableId = await resolveAccountId('Accounts Payable', 'Liability')
            
            console.log(`Creating journal entry for credit purchase invoice ${invoice.invoice_number}`)
            console.log(`  Invoice ID: ${invoiceId}`)
            console.log(`  User ID: ${userId}`)
            console.log(`  Inventory Account ID: ${inventoryAccountId}`)
            console.log(`  Accounts Payable Account ID: ${accountsPayableId}`)
            console.log(`  Total Amount: ${invoice.total_amount}`)
            
            try {
              await createJournalEntry({
                date: invoice.invoice_date,
                reference: invoice.invoice_number,
                description: `Purchase Invoice: ${invoice.invoice_number} (Credit Purchase)`,
                entries: [
                  {
                    account_id: inventoryAccountId,
                    account_name: 'Inventory',
                    debit: invoice.total_amount,
                    credit: 0,
                  },
                  {
                    account_id: accountsPayableId,
                    account_name: 'Accounts Payable',
                    debit: 0,
                    credit: invoice.total_amount,
                  },
                ],
                createdBy: userId,
                source_module: 'purchase_invoice',
                // Legacy fields for backward compatibility
                referenceType: 'Purchase',
                referenceId: invoiceId,
              })
              console.log(`✅ Journal entry created successfully for credit purchase invoice ${invoice.invoice_number}`)
            } catch (journalError: any) {
              console.error(`❌ Error creating journal entry for credit purchase invoice ${invoice.invoice_number}:`, journalError)
              console.error(`   Error message: ${journalError.message}`)
              console.error(`   Error stack: ${journalError.stack}`)
              // Don't re-throw - we want the invoice to be created even if journal entry fails
              // But log it clearly so it's visible
            }
          } else {
            console.error(`❌ Cannot create journal entry: invoiceId is missing for invoice ${invoice.invoice_number}`)
          }
        } else {
          console.error(`❌ Cannot create journal entry: userId is missing for invoice ${invoice.invoice_number}`)
        }
      } catch (error: any) {
        console.error(`❌ Unexpected error in credit purchase processing for invoice ${invoice.invoice_number}:`, error)
        console.error(`   Error message: ${error.message}`)
        console.error(`   Error stack: ${error.stack}`)
        // Don't fail the invoice creation
      }
    } else {
      // Neither paid nor credit purchase - log for debugging
      console.warn(`⚠️  Purchase invoice ${invoice.invoice_number} has unclear payment status: ${invoice.payment_status}`)
      console.warn(`   Payment method: ${invoice.payment_method || 'none'}`)
      console.warn(`   isPaid: ${isPaid}, isCashPurchase: ${isCashPurchase}, isCreditPurchase: ${isCreditPurchase}`)
    }
    
    // Refresh invoice from database to ensure we return the latest state
    const updatedInvoice = await getPurchaseInvoiceById(String(invoice._id))
    
    res.status(201).json({ success: true, data: updatedInvoice || invoice })
  } catch (error: any) {
    console.error('Error creating purchase invoice:', error)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    
    // If it's a validation error, provide more details
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors || {}).map(key => ({
        field: key,
        message: error.errors[key].message
      }))
      console.error('Validation errors:', validationErrors)
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: validationErrors,
        details: error.message 
      })
    }
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}

export const getPurchases = async (req: Request, res: Response) => {
  try {
    const invoices = await listPurchaseInvoices({
      q: req.query.q as string,
      vendor_id: req.query.vendor_id as string,
      payment_status: req.query.payment_status as string,
      from: req.query.from as string,
      to: req.query.to as string,
    })
    res.json({ success: true, data: invoices })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getPurchase = async (req: Request, res: Response) => {
  try {
    const invoice = await getPurchaseInvoiceById(req.params.id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }
    res.json({ success: true, data: invoice })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getPurchaseInvoiceQrCode = async (req: Request, res: Response) => {
  try {
    const invoice = await getPurchaseInvoiceById(req.params.id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }
    const vendor = invoice.vendor_id as any
    const sellerName = (typeof vendor === 'object' && vendor?.name) ? vendor.name : 'Vendor'
    const trn = invoice.trn || (typeof vendor === 'object' && vendor?.trn) ? (vendor as any).trn : ''
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

export const updatePurchase = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    
    // Get existing invoice before update to find journal entries
    const existingInvoice = await getPurchaseInvoiceById(req.params.id)
    if (!existingInvoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    // Get invoice ID as string
    const invoiceId = typeof existingInvoice._id === 'string' 
      ? existingInvoice._id 
      : (existingInvoice._id as any)?.toString()

    // Reverse inventory transactions before updating (restore quantities from old line items)
    try {
      await reverseInventoryTransactions(existingInvoice.invoice_number, invoiceId)
    } catch (inventoryError: any) {
      console.error('Error reversing inventory transactions for purchase update:', inventoryError)
      // Continue with update even if inventory reversal fails
    }

    // Find and delete all related journal entries before updating
    if (invoiceId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Purchase', invoiceId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'purchase_invoice',
          reference: existingInvoice.invoice_number,
        }).exec()

        // Also find journal entries created by payable service
        // If invoice has a payable_id, find journal entries for that payable
        let journalEntriesByPayable: any[] = []
        if (existingInvoice.payable_id) {
          // Properly extract payable ID (handle both string and populated object)
          let payableId: string
          const payableRef = existingInvoice.payable_id as any
          if (typeof payableRef === 'string') {
            payableId = payableRef
          } else if (payableRef && typeof payableRef === 'object') {
            // Handle populated object
            if (payableRef.id !== undefined) {
              payableId = String(payableRef.id)
            } else if (payableRef._id) {
              payableId = typeof payableRef._id === 'string' 
                ? payableRef._id 
                : String(payableRef._id)
            } else {
              payableId = String(payableRef)
            }
          } else {
            payableId = String(payableRef)
          }
          
          // Validate payableId is a valid ObjectId format
          const mongoose = await import('mongoose')
          if (mongoose.Types.ObjectId.isValid(payableId) && payableId.length === 24) {
            journalEntriesByPayable = await JournalEntry.find({
              $or: [
                { referenceType: 'Payable', referenceId: payableId },
                { source_module: 'payable', reference: existingInvoice.invoice_number },
              ]
            }).exec()
          }
        }

        // Find journal entries for material costs of products in this invoice
        let materialCostJournalEntries: any[] = []
        if (existingInvoice.line_items && existingInvoice.line_items.length > 0) {
          for (const lineItem of existingInvoice.line_items) {
            const productId = typeof lineItem.product === 'string' 
              ? lineItem.product 
              : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
            
            if (!productId) continue

            // Find journal entries for material costs of this product
            const productMaterialEntries = await JournalEntry.find({
              source_module: 'inventory',
              referenceType: 'Inventory',
              referenceId: productId,
              description: { $regex: /Material cost allocation/i },
            }).exec()
            
            materialCostJournalEntries.push(...productMaterialEntries)
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
        journalEntriesByPayable.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        materialCostJournalEntries.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for purchase invoice update:', journalError)
        // Continue with invoice update even if journal entry deletion fails
      }
    }

    // Determine payment status based on amount changes
    // If editing and amount changes, update status accordingly
    const oldTotalAmount = existingInvoice.total_amount || 0
    const newTotalAmount = req.body.total_amount !== undefined ? req.body.total_amount : oldTotalAmount
    const existingStatus = existingInvoice.payment_status?.toLowerCase() || 'unpaid'
    
    // If payment_status is not explicitly provided in the update, determine it based on amount changes
    // Only update status if the invoice was already paid/partial and amount changed
    if (!req.body.payment_status && oldTotalAmount !== newTotalAmount) {
      // If invoice was paid or partial, and amount changed, update status
      if (existingStatus === 'paid' || existingStatus === 'partial') {
        if (oldTotalAmount > newTotalAmount) {
          // Previous amount is greater than new amount → Partial paid (overpaid/extra)
          // This means the invoice was reduced after payment, so it's now overpaid
          req.body.payment_status = 'partial'
          // Calculate balance_due: if it was fully paid, new balance_due = 0 (overpaid)
          // If it was partial, adjust balance_due proportionally
          if (existingStatus === 'paid') {
            req.body.balance_due = 0 // Was fully paid, now overpaid (balance_due = 0)
          } else {
            // Was partially paid, adjust balance_due
            const oldBalanceDue = existingInvoice.balance_due || 0
            const oldPaidAmount = oldTotalAmount - oldBalanceDue
            // Calculate new balance_due, ensuring it's between 0 and newTotalAmount
            const newBalanceDue = Math.max(0, Math.min(newTotalAmount, newTotalAmount - oldPaidAmount))
            req.body.balance_due = newBalanceDue
          }
        } else if (oldTotalAmount < newTotalAmount) {
          // Previous amount is less than new amount → Partial paid (still owes more)
          // Invoice amount increased, so if it was paid, it's now partially paid
          req.body.payment_status = 'partial'
          // Calculate balance_due: increase by the difference
          const oldBalanceDue = existingInvoice.balance_due || 0
          const amountDifference = newTotalAmount - oldTotalAmount
          // Ensure balance_due doesn't exceed new total amount
          req.body.balance_due = Math.min(newTotalAmount, oldBalanceDue + amountDifference)
        }
      }
    }
    
    // If payment_status is still not set, preserve existing status or default to 'unpaid'
    if (!req.body.payment_status) {
      req.body.payment_status = existingInvoice.payment_status || 'unpaid'
    }

    // Update the invoice
    const invoice = await updatePurchaseInvoice(req.params.id, req.body)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    // Record stock movements for updated line items (add new quantities to inventory)
    if (invoice.line_items && invoice.line_items.length > 0) {
      for (const lineItem of invoice.line_items) {
        const productId = typeof lineItem.product === 'string' 
          ? lineItem.product 
          : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
        
        if (!productId) continue

        const inventoryItem = await getInventoryById(productId)
        if (!inventoryItem) continue

        const unitCost = lineItem.unit_cost || (lineItem.total / lineItem.quantity) || inventoryItem.unit_cost

        try {
          await recordStockMovement({
            product_id: productId,
            type: 'purchase',
            reference: invoice.invoice_number,
            reference_id: (invoice._id as any)?.toString() || String(invoice._id),
            quantity: lineItem.quantity,
            unit_cost: unitCost,
            date: invoice.invoice_date,
            notes: `Purchase from ${invoice.invoice_number} (updated)`,
            createdBy: userId,
            createJournalEntry: false,
          })
        } catch (stockError: any) {
          console.error('Error recording stock movement for purchase update:', stockError)
        }
      }
    }

    // Update linked payable if it exists
    if (invoice.payable_id) {
      try {
        const payableId = typeof invoice.payable_id === 'string' 
          ? invoice.payable_id 
          : (invoice.payable_id as any)?._id?.toString() || String(invoice.payable_id)
        
        if (payableId) {
          await updatePayable(payableId, {
            bill_number: invoice.invoice_number,
            bill_date: invoice.invoice_date,
            due_date: invoice.due_date,
            total_amount: invoice.total_amount,
            skipJournalEntry: true, // Journal entries are handled by invoice update
            userId: userId, // Pass userId for journal entry recreation if needed
          } as any)
        }
      } catch (payableError: any) {
        console.error('Error updating linked payable:', payableError)
        // Continue even if payable update fails
      }
    }

    // Recreate material cost journal entries for products in the invoice
    if (userId && invoice.line_items && invoice.line_items.length > 0) {
      try {
        for (const lineItem of invoice.line_items) {
          const productId = typeof lineItem.product === 'string' 
            ? lineItem.product 
            : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
          
          if (!productId) continue

          const inventoryItem = await getInventoryById(productId)
          if (!inventoryItem) continue

          // Check if product has material costs
          if (
            !inventoryItem.priceInclusiveMaterialCost &&
            inventoryItem.materialCostComponents &&
            Array.isArray(inventoryItem.materialCostComponents) &&
            inventoryItem.materialCostComponents.length > 0
          ) {
            const totalMaterialCost = inventoryItem.materialCostComponents.reduce(
              (sum: number, comp: { account_id: string; account_name: string; amount: number; description?: string }) => sum + (comp.amount || 0),
              0
            )

            if (totalMaterialCost > 0) {
              // Recreate journal entry for material cost allocation
              const journalEntries: any[] = []

              // Debit: Inventory account (sum of all material costs)
              const inventoryAccountId = await resolveAccountId('Inventory', 'Asset')
              journalEntries.push({
                account_id: inventoryAccountId,
                account_name: 'Inventory',
                debit: totalMaterialCost,
                credit: 0,
              })

              // Credit: Each expense/material cost account (individual material costs)
              for (const component of inventoryItem.materialCostComponents) {
                if (component.amount > 0 && component.account_id && component.account_name) {
                  journalEntries.push({
                    account_id: component.account_id,
                    account_name: component.account_name,
                    debit: 0,
                    credit: component.amount,
                  })
                }
              }

              // Create journal entry for material cost allocation
              await createJournalEntry({
                date: invoice.invoice_date || new Date(),
                reference: inventoryItem.sku || inventoryItem.serialNumber || String(inventoryItem._id),
                description: `Material cost allocation for inventory item: ${inventoryItem.product_name || inventoryItem.name || inventoryItem.sku}`,
                entries: journalEntries,
                createdBy: userId,
                source_module: 'inventory',
                referenceType: 'Inventory',
                referenceId: String(inventoryItem._id),
              })
            }
          }
        }
      } catch (materialCostError: any) {
        console.error('Error recreating material cost journal entries:', materialCostError)
        // Continue even if material cost journal entry recreation fails
      }
    }

    // Recreate journal entries based on updated invoice data
    if (userId) {
      try {
        // Determine payment status
        const paymentStatus = invoice.payment_status?.toLowerCase() || 'unpaid'
        const isPaid = paymentStatus === 'paid'
        const isCashPurchase = isPaid && invoice.payment_method
        const isCreditPurchase = !isPaid && (paymentStatus === 'unpaid' || paymentStatus === 'partial')

        // Recreate journal entries based on payment status
        if (isPaid && isCashPurchase) {
          // Paid Cash Purchase: Debit Inventory, Credit Cash/Bank
          // Get payment account mapping
          const paymentMapping = getPaymentAccountMapping(invoice.payment_method)
          
          // Calculate bank charges for card payments
          let bankCharges = 0
          let description = `Purchase Invoice: ${invoice.invoice_number} (Cash Purchase)${invoice.reference_number ? ` (Ref: ${invoice.reference_number})` : ''}`
          
          if (paymentMapping.bankChargesPercentage) {
            bankCharges = calculateBankCharges(invoice.total_amount, paymentMapping.bankChargesPercentage)
            description = formatJournalDescriptionWithBankCharges(invoice.total_amount, bankCharges, description)
          }
          
          // Resolve account IDs from database
          const inventoryAccountId = await resolveAccountId('Inventory', 'Asset')
          const cashAccountId = await resolveAccountId(paymentMapping.account_name, 'Asset')
          
          console.log(`Updating journal entry for cash purchase invoice ${invoice.invoice_number}`)
          console.log(`  Inventory Account ID: ${inventoryAccountId}`)
          console.log(`  Cash Account ID: ${cashAccountId}`)
          
          try {
            // Note: Bank charges are shown in description but NOT added to the amounts
            // The debit/credit amounts remain the same as the invoice total_amount
            await createJournalEntry({
              date: invoice.invoice_date,
              reference: invoice.invoice_number,
              description,
              entries: [
                {
                  account_id: inventoryAccountId,
                  account_name: 'Inventory',
                  debit: invoice.total_amount,
                  credit: 0,
                },
                {
                  account_id: cashAccountId,
                  account_name: paymentMapping.account_name,
                  debit: 0,
                  credit: invoice.total_amount,
                },
              ],
              createdBy: userId,
              source_module: 'purchase_invoice',
              referenceType: 'Purchase',
              referenceId: String(invoice._id),
            })
            console.log(`✅ Journal entry updated for cash purchase invoice ${invoice.invoice_number}`)
          } catch (journalError: any) {
            console.error(`❌ Error creating journal entry for cash purchase invoice update ${invoice.invoice_number}:`, journalError)
            console.error(`   Error message: ${journalError.message}`)
            console.error(`   Error stack: ${journalError.stack}`)
            // Don't block invoice update - continue
          }
        } else if (isCreditPurchase) {
          // Credit Purchase: Debit Inventory, Credit Accounts Payable
          // Resolve account IDs from database
          const inventoryAccountId = await resolveAccountId('Inventory', 'Asset')
          const accountsPayableId = await resolveAccountId('Accounts Payable', 'Liability')
          
          console.log(`Updating journal entry for credit purchase invoice ${invoice.invoice_number}`)
          console.log(`  Inventory Account ID: ${inventoryAccountId}`)
          console.log(`  Accounts Payable Account ID: ${accountsPayableId}`)
          
          try {
            await createJournalEntry({
              date: invoice.invoice_date,
              reference: invoice.invoice_number,
              description: `Purchase Invoice: ${invoice.invoice_number} (Credit Purchase)`,
              entries: [
                {
                  account_id: inventoryAccountId,
                  account_name: 'Inventory',
                  debit: invoice.total_amount,
                  credit: 0,
                },
                {
                  account_id: accountsPayableId,
                  account_name: 'Accounts Payable',
                  debit: 0,
                  credit: invoice.total_amount,
                },
              ],
              createdBy: userId,
              source_module: 'purchase_invoice',
              referenceType: 'Purchase',
              referenceId: String(invoice._id),
            })
            console.log(`✅ Journal entry updated for credit purchase invoice ${invoice.invoice_number}`)
          } catch (journalError: any) {
            console.error(`❌ Error creating journal entry for credit purchase invoice update ${invoice.invoice_number}:`, journalError)
            console.error(`   Error message: ${journalError.message}`)
            console.error(`   Error stack: ${journalError.stack}`)
            // Don't block invoice update - continue
          }
        }
      } catch (journalError: any) {
        console.error('Error recreating journal entries for purchase invoice update:', journalError)
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

// Apply payment to a credit purchase invoice
export const applyPayment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const invoice = await getPurchaseInvoiceById(req.params.id)
    
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    // Check if invoice has a payable (credit purchase)
    if (!invoice.payable_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'This invoice is not a credit purchase. Payments can only be applied to credit purchases.' 
      })
    }

    const { date, amount, payment_method, reference_number, notes } = req.body

    if (!date || !amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment date and amount are required. Amount must be greater than 0.' 
      })
    }

    // Extract payable ID - handle both populated object and ObjectId
    const payableRef = invoice.payable_id as any
    let payableId: string
    
    if (payableRef && typeof payableRef === 'object') {
      // Check if it has .id property (Mongoose Document getter)
      if (payableRef.id !== undefined) {
        payableId = String(payableRef.id)
      } 
      // Check if it's a populated document with _id
      else if (payableRef._id && typeof payableRef._id === 'object' && payableRef._id.toString) {
        payableId = payableRef._id.toString()
      }
      // Check if it's an ObjectId with toString method
      else if (payableRef.toString && typeof payableRef.toString === 'function') {
        payableId = payableRef.toString()
      }
      // Fallback
      else {
        payableId = String(payableRef)
      }
    } else {
      payableId = String(invoice.payable_id)
    }

    // Record payment in Payable
    const payable = await recordPayment(
      payableId,
      {
        date,
        amount,
        paymentMethod: payment_method,
        referenceNumber: reference_number,
        notes,
      },
      userId
    )

    if (!payable) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to record payment in payable' 
      })
    }

    // Update invoice balance_due and payment_status based on payable
    invoice.balance_due = payable.balance_due
    invoice.payment_status = payable.status as any
    await invoice.save()

    res.json({ 
      success: true, 
      data: {
        invoice,
        payable,
        message: 'Payment applied successfully',
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deletePurchase = async (req: Request, res: Response) => {
  try {
    // Get invoice before deletion to restore inventory
    const invoice = await getPurchaseInvoiceById(req.params.id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    // Get invoice ID as string
    const invoiceId = typeof invoice._id === 'string' 
      ? invoice._id 
      : (invoice._id as any)?.toString()

    // Find and delete all related journal entries
    // Journal entries are linked via referenceType: 'Purchase' and referenceId: invoice._id
    // or via source_module: 'purchase_invoice' and reference: invoice.invoice_number
    if (invoiceId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Purchase', invoiceId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'purchase_invoice',
          reference: invoice.invoice_number,
        }).exec()

        // Find journal entries for material costs of products in this invoice
        let materialCostJournalEntries: any[] = []
        if (invoice.line_items && invoice.line_items.length > 0) {
          for (const lineItem of invoice.line_items) {
            const productId = typeof lineItem.product === 'string' 
              ? lineItem.product 
              : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
            
            if (!productId) continue

            // Find journal entries for material costs of this product
            const productMaterialEntries = await JournalEntry.find({
              source_module: 'inventory',
              referenceType: 'Inventory',
              referenceId: productId,
              description: { $regex: /Material cost allocation/i },
            }).exec()
            
            materialCostJournalEntries.push(...productMaterialEntries)
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
        materialCostJournalEntries.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for purchase invoice:', journalError)
        // Continue with invoice deletion even if journal entry deletion fails
      }
    }

    // Reverse inventory transactions (subtract quantities and delete transaction records)
    try {
      await reverseInventoryTransactions(invoice.invoice_number, invoiceId)
    } catch (inventoryError: any) {
      console.error('Error reversing inventory transactions for purchase delete:', inventoryError)
      // Continue with deletion even if inventory reversal fails
    }

    // Delete linked payable if it exists
    if (invoice.payable_id) {
      try {
        // Properly extract payable ID (handle both string and populated object)
        let payableId: string
        const payableRef = invoice.payable_id as any
        if (typeof payableRef === 'string') {
          payableId = payableRef
        } else if (payableRef && typeof payableRef === 'object') {
          // Handle populated object
          if (payableRef.id !== undefined) {
            payableId = String(payableRef.id)
          } else if (payableRef._id) {
            payableId = typeof payableRef._id === 'string' 
              ? payableRef._id 
              : String(payableRef._id)
          } else {
            payableId = String(payableRef)
          }
        } else {
          payableId = String(payableRef)
        }
        
        // Validate payableId is a valid ObjectId format
        const mongoose = await import('mongoose')
        if (payableId && mongoose.Types.ObjectId.isValid(payableId) && payableId.length === 24) {
          // Find and delete journal entries for payable first
          const JournalEntry = (await import('../models/JournalEntry')).default
          const payableJournalEntries = await JournalEntry.find({
            $or: [
              { referenceType: 'Payable', referenceId: payableId },
              { source_module: 'payable', reference: invoice.invoice_number },
              { source_module: 'payable_payment', reference: invoice.invoice_number },
            ]
          }).exec()

          for (const journalEntry of payableJournalEntries) {
            await deleteJournalEntry(String(journalEntry._id))
          }

          // Delete the payable
          await deletePayable(payableId)
        }
      } catch (payableError: any) {
        console.error('Error deleting linked payable:', payableError)
        // Continue with invoice deletion even if payable deletion fails
      }
    }

    await deletePurchaseInvoice(req.params.id)
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

// Generate shareable link for purchase invoice
export const generateShareLink = async (req: Request, res: Response) => {
  try {
    const invoice = await getPurchaseInvoiceById(req.params.id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    
    shareLinks.set(token, { invoiceId: req.params.id, expiresAt, type: 'purchase' })

    // Get base URL from request origin, environment variable, or default
    const origin = req.get('origin') || req.get('referer')?.split('/').slice(0, 3).join('/')
    const baseUrl = origin || process.env.FRONTEND_URL || 'http://localhost:3000'
    const shareUrl = `${baseUrl}/share/purchase-invoice/${token}`

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

    if (linkData.type !== 'purchase') {
      return res.status(400).json({ success: false, message: 'Invalid share link type' })
    }

    const invoice = await getPurchaseInvoiceById(linkData.invoiceId)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' })
    }

    res.json({ success: true, data: invoice })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}
