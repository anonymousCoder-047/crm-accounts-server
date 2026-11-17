import Receivable, { IReceivable, IPayment } from '../models/Receivable'
import SalesInvoice from '../models/SalesInvoice'
import { FilterQuery } from 'mongoose'
import { createJournalEntry } from './journalEntryService'
import { getPaymentAccountMapping, calculateBankCharges, formatJournalDescriptionWithBankCharges } from '../utils/paymentMethodMapper'

export interface ReceivableInput {
  customer_id: string
  invoice_number: string
  invoice_date: Date | string
  due_date: Date | string
  total_amount: number
  tax_amount?: number
  currency?: string
  credit_limit?: number
  payment_terms?: string
  notes?: string
  isPaid?: boolean // If true, create receivable with paid status
  paymentMethod?: string // Required if isPaid is true
  paymentDate?: Date | string // Payment date if isPaid is true
  paymentReference?: string // Payment reference if isPaid is true
  skipJournalEntry?: boolean // If true, skip journal entry creation (used when invoice controller creates it)
}

export interface PaymentInput {
  date: Date | string
  amount: number
  paymentMethod?: string
  referenceNumber?: string
  notes?: string
}

export async function createReceivable(input: ReceivableInput, userId?: string): Promise<IReceivable> {
  const isPaid = input.isPaid === true
  const initialPayment: IPayment | undefined = isPaid && input.paymentMethod
    ? {
        date: new Date(input.paymentDate || input.invoice_date),
        amount: input.total_amount,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.paymentReference,
        notes: `Initial payment for invoice: ${input.invoice_number}`,
        createdAt: new Date(),
      }
    : undefined

  const receivable = await Receivable.create({
    ...input,
    tax_amount: input.tax_amount || 0,
    currency: input.currency || 'AED',
    balance_due: isPaid ? 0 : input.total_amount,
    status: isPaid ? 'paid' : 'unpaid',
    payments: initialPayment ? [initialPayment] : [],
  })

  // Create journal entry: Debit Accounts Receivable, Credit Sales Revenue (only for unpaid)
  // For paid receivables, the invoice controller creates the cash sale journal entry
  if (userId && !input.skipJournalEntry && !isPaid) {
    try {
      console.log(`Creating journal entry for unpaid receivable: ${input.invoice_number}`)
      console.log(`  Receivable ID: ${receivable._id}`)
      console.log(`  User ID: ${userId}`)
      console.log(`  Amount: ${input.total_amount}`)
      
      const journalEntry = await createJournalEntry({
        date: new Date(input.invoice_date),
        reference: input.invoice_number,
        description: `Invoice issued: ${input.invoice_number}`,
        entries: [
          {
            account_id: 'ACCOUNTS_RECEIVABLE',
            account_name: 'Accounts Receivable',
            debit: input.total_amount,
            credit: 0,
          },
          {
            account_id: 'SALES_REVENUE',
            account_name: 'Sales Revenue',
            debit: 0,
            credit: input.total_amount,
          },
        ],
        createdBy: userId,
        source_module: 'receivable',
        // Legacy fields for backward compatibility
        referenceType: 'Receivable',
        referenceId: String(receivable._id),
      })
      
      console.log(`✅ Journal entry created successfully for receivable ${input.invoice_number} (ID: ${journalEntry._id})`)
    } catch (journalError: any) {
      // Log error but don't fail the receivable creation
      console.error('❌ Error creating journal entry for receivable:', journalError)
      console.error('   Error message:', journalError.message)
      console.error('   Error stack:', journalError.stack)
    }
  } else {
    if (!userId) {
      console.warn(`⚠️  Skipping journal entry creation for receivable ${input.invoice_number}: userId is missing`)
    } else if (input.skipJournalEntry) {
      console.log(`ℹ️  Skipping journal entry creation for receivable ${input.invoice_number}: skipJournalEntry is true`)
    } else if (isPaid) {
      console.log(`ℹ️  Skipping journal entry creation for receivable ${input.invoice_number}: receivable is paid (journal entry created by invoice controller)`)
    }
  }

  // For paid receivables, create payment journal entry (only if not skipped)
  // Note: When skipJournalEntry is true, the invoice controller already created the revenue entry
  // so we should NOT create a duplicate payment entry here
  if (userId && isPaid && initialPayment && !input.skipJournalEntry) {
    try {
      console.log(`Creating payment journal entry for paid receivable: ${input.invoice_number}`)
      console.log(`  Receivable ID: ${receivable._id}`)
      console.log(`  Payment Method: ${input.paymentMethod}`)
      console.log(`  Amount: ${initialPayment.amount}`)
      
      // Get payment account mapping
      const paymentMapping = getPaymentAccountMapping(input.paymentMethod)
      
      // Calculate bank charges for card payments
      let bankCharges = 0
      let description = `Payment received for invoice: ${input.invoice_number}${initialPayment.referenceNumber ? ` (Ref: ${initialPayment.referenceNumber})` : ''}`
      
      if (paymentMapping.bankChargesPercentage) {
        bankCharges = calculateBankCharges(initialPayment.amount, paymentMapping.bankChargesPercentage)
        description = formatJournalDescriptionWithBankCharges(initialPayment.amount, bankCharges, description)
      }
      
      // Note: Bank charges are shown in description but NOT added to the amounts
      // The debit/credit amounts remain the same as the payment amount
      const journalEntry = await createJournalEntry({
        date: new Date(initialPayment.date),
        reference: initialPayment.referenceNumber || input.invoice_number,
        description,
        entries: [
          {
            account_id: paymentMapping.account_id,
            account_name: paymentMapping.account_name,
            debit: initialPayment.amount,
            credit: 0,
          },
          {
            account_id: 'ACCOUNTS_RECEIVABLE',
            account_name: 'Accounts Receivable',
            debit: 0,
            credit: initialPayment.amount,
          },
        ],
        createdBy: userId,
        source_module: 'receivable',
        // Legacy fields for backward compatibility
        referenceType: 'Receivable',
        referenceId: String(receivable._id),
      })
      
      console.log(`✅ Payment journal entry created successfully for receivable ${input.invoice_number} (ID: ${journalEntry._id})`)
    } catch (journalError: any) {
      console.error('❌ Error creating journal entry for paid receivable:', journalError)
      console.error('   Error message:', journalError.message)
      console.error('   Error stack:', journalError.stack)
    }
  }

  return receivable
}

export async function listReceivables(query?: {
  q?: string
  customer_id?: string
  status?: string
  from?: string
  to?: string
}): Promise<IReceivable[]> {
  const filter: FilterQuery<IReceivable> = {}
  
  if (query?.q) {
    filter.$or = [
      { invoice_number: new RegExp(query.q, 'i') },
      { notes: new RegExp(query.q, 'i') },
    ]
  }
  
  if (query?.customer_id) {
    filter.customer_id = query.customer_id as any
  }
  
  if (query?.status) {
    filter.status = query.status
  }
  
  if (query?.from || query?.to) {
    filter.invoice_date = {}
    if (query.from) (filter.invoice_date as any).$gte = new Date(query.from)
    if (query.to) (filter.invoice_date as any).$lte = new Date(query.to)
  }
  
  return Receivable.find(filter)
    .populate('customer_id')
    .sort({ invoice_date: -1, createdAt: -1 })
}

export async function getReceivableById(id: string): Promise<IReceivable | null> {
  return Receivable.findById(id).populate('customer_id')
}

export async function updateReceivableStatus(
  id: string,
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'
): Promise<IReceivable | null> {
  return Receivable.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  ).populate('customer_id')
}

export async function updateReceivable(
  id: string,
  updates: Partial<ReceivableInput>
): Promise<IReceivable | null> {
  // Get existing receivable to find its journal entries
  const existingReceivable = await Receivable.findById(id)
  if (!existingReceivable) {
    return null
  }

  // Delete existing journal entries before updating
  try {
    const JournalEntry = (await import('../models/JournalEntry')).default
    const { deleteJournalEntry } = await import('./journalEntryService')
    
    // Find journal entries by referenceType and referenceId
    const journalEntries = await JournalEntry.find({
      $or: [
        { referenceType: 'Receivable', referenceId: id },
        { source_module: 'receivable', reference: existingReceivable.invoice_number },
      ]
    }).exec()

    // Delete all journal entries (this will also delete their GL entries)
    for (const journalEntry of journalEntries) {
      await deleteJournalEntry(String(journalEntry._id))
    }
  } catch (journalError: any) {
    console.error('Error deleting journal entries for receivable update:', journalError)
    // Continue with receivable update even if journal entry deletion fails
  }

  // Extract userId from updates if provided
  const userId = (updates as any).userId
  
  // Remove userId from updates before saving (it's not a field in the model)
  const { userId: _, ...updateFields } = updates as any
  
  // Update the receivable - use findOneAndUpdate then save to trigger pre-save hook for status calculation
  let updatedReceivable = await Receivable.findById(id)
  if (!updatedReceivable) {
    return null
  }
  
  // Apply updates
  Object.assign(updatedReceivable, updateFields)
  
  // Save to trigger pre-save hook which recalculates status and balance_due
  updatedReceivable = await updatedReceivable.save()
  
  // Recreate journal entries if needed (only if receivable is unpaid and not skipping)
  if (updatedReceivable && !updates.skipJournalEntry && updatedReceivable.status !== 'paid') {
    if (userId) {
      try {
        await createJournalEntry({
          date: new Date(updatedReceivable.invoice_date),
          reference: updatedReceivable.invoice_number,
          description: `Invoice issued: ${updatedReceivable.invoice_number}`,
          entries: [
            {
              account_id: 'ACCOUNTS_RECEIVABLE',
              account_name: 'Accounts Receivable',
              debit: updatedReceivable.total_amount,
              credit: 0,
            },
            {
              account_id: 'SALES_REVENUE',
              account_name: 'Sales Revenue',
              debit: 0,
              credit: updatedReceivable.total_amount,
            },
          ],
          createdBy: userId,
          source_module: 'receivable',
          referenceType: 'Receivable',
          referenceId: String(updatedReceivable._id),
        })
      } catch (journalError: any) {
        console.error('Error recreating journal entry for receivable update:', journalError)
      }
    }
  }

  return updatedReceivable
}

export async function recordPayment(
  id: string,
  payment: PaymentInput,
  userId?: string
): Promise<IReceivable | null> {
  const receivable = await Receivable.findById(id)
  if (!receivable) {
    throw new Error('Receivable not found')
  }

  // Add payment
  receivable.payments.push({
    ...payment,
    date: new Date(payment.date),
  } as IPayment)

  // Save to trigger pre-save hook for status calculation
  await receivable.save()

  // Update linked sales invoice payment status
  try {
    const salesInvoice = await SalesInvoice.findOne({ receivable_id: receivable._id })
    if (salesInvoice) {
      salesInvoice.payment_status = receivable.status as any
      salesInvoice.balance_due = receivable.balance_due
      await salesInvoice.save()
      console.log(`Updated sales invoice ${salesInvoice.invoice_number} payment status to ${receivable.status}`)
    }
  } catch (invoiceError: any) {
    // Log error but don't fail the payment recording
    console.error('Error updating linked sales invoice:', invoiceError)
  }

  // Create journal entry: Debit Cash/Bank, Credit Accounts Receivable
  if (userId) {
    try {
      console.log(`Creating payment journal entry for receivable: ${receivable.invoice_number}`)
      console.log(`  Receivable ID: ${receivable._id}`)
      console.log(`  Payment Method: ${payment.paymentMethod}`)
      console.log(`  Amount: ${payment.amount}`)
      console.log(`  User ID: ${userId}`)
      
      // Get payment account mapping
      const paymentMapping = getPaymentAccountMapping(payment.paymentMethod)
      
      // Calculate bank charges for card payments
      let bankCharges = 0
      let description = `Payment received for invoice: ${receivable.invoice_number}${payment.referenceNumber ? ` (Ref: ${payment.referenceNumber})` : ''}`
      
      if (paymentMapping.bankChargesPercentage) {
        bankCharges = calculateBankCharges(payment.amount, paymentMapping.bankChargesPercentage)
        description = formatJournalDescriptionWithBankCharges(payment.amount, bankCharges, description)
      }
      
      // Use a unique reference for payment entries to avoid duplicate detection
      // Combine receivable ID with payment date and amount to make it unique
      const paymentReference = payment.referenceNumber || `${receivable.invoice_number}-PAY-${new Date(payment.date).getTime()}-${payment.amount}`
      
      // Note: Bank charges are shown in description but NOT added to the amounts
      // The debit/credit amounts remain the same as the payment amount
      // Use the actual receivable ID for referenceId (must be ObjectId), and rely on
      // source_module + reference for uniqueness to prevent duplicates
      const journalEntry = await createJournalEntry({
        date: new Date(payment.date),
        reference: paymentReference,
        description,
        entries: [
          {
            account_id: paymentMapping.account_id,
            account_name: paymentMapping.account_name,
            debit: payment.amount,
            credit: 0,
          },
          {
            account_id: 'ACCOUNTS_RECEIVABLE',
            account_name: 'Accounts Receivable',
            debit: 0,
            credit: payment.amount,
          },
        ],
        createdBy: userId,
        source_module: 'receivable_payment', // Use different source_module to distinguish from initial receivable entry
        // Legacy fields for backward compatibility
        // Use the actual receivable ID (ObjectId) for referenceId
        // The source_module difference ('receivable_payment' vs 'receivable') and unique reference prevent duplicate detection
        referenceType: 'Receivable',
        referenceId: String(receivable._id), // Must be a valid ObjectId string
      })
      
      console.log(`✅ Payment journal entry created successfully for receivable ${receivable.invoice_number} (ID: ${journalEntry._id})`)
    } catch (journalError: any) {
      // Log error but don't fail the payment recording
      console.error('❌ Error creating journal entry for payment:', journalError)
      console.error('   Error message:', journalError.message)
      console.error('   Error stack:', journalError.stack)
    }
  } else {
    console.warn(`⚠️  Skipping journal entry creation for payment: userId is missing`)
  }

  return receivable
}

export async function closeReceivable(id: string): Promise<IReceivable | null> {
  const receivable = await Receivable.findById(id)
  if (!receivable) {
    throw new Error('Receivable not found')
  }

  // Calculate total payments
  const totalPaid = receivable.payments.reduce((sum, payment) => sum + payment.amount, 0)
  
  if (totalPaid < receivable.total_amount) {
    throw new Error('Cannot close receivable: balance is not fully paid')
  }

  // Status will be automatically set to 'paid' by pre-save hook
  return receivable.save()
}

export async function deleteReceivable(id: string): Promise<IReceivable | null> {
  return Receivable.findByIdAndDelete(id)
}
