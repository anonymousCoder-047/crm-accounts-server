import Payable, { IPayable, IPayment } from '../models/Payable'
import PurchaseInvoice from '../models/PurchaseInvoice'
import { FilterQuery } from 'mongoose'
import { createJournalEntry } from './journalEntryService'
import { getPaymentAccountMapping, calculateBankCharges, formatJournalDescriptionWithBankCharges } from '../utils/paymentMethodMapper'

export interface PayableInput {
  vendor_id: string
  bill_number: string
  bill_date: Date | string
  due_date: Date | string
  total_amount: number
  tax_amount?: number
  currency?: string
  payment_terms?: string
  notes?: string
  isPaid?: boolean // If true, create payable with paid status
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

export async function createPayable(input: PayableInput, userId?: string): Promise<IPayable> {
  const isPaid = input.isPaid === true
  const initialPayment: IPayment | undefined = isPaid && input.paymentMethod
    ? {
        date: new Date(input.paymentDate || input.bill_date),
        amount: input.total_amount,
        paymentMethod: input.paymentMethod,
        referenceNumber: input.paymentReference,
        notes: `Initial payment for bill: ${input.bill_number}`,
        createdAt: new Date(),
      }
    : undefined

  const payable = await Payable.create({
    ...input,
    tax_amount: input.tax_amount || 0,
    currency: input.currency || 'AED',
    balance_due: isPaid ? 0 : input.total_amount,
    status: isPaid ? 'paid' : 'unpaid',
    payments: initialPayment ? [initialPayment] : [],
  })

  // Create journal entry: Debit Expense/Inventory, Credit Accounts Payable (only for unpaid)
  // For paid payables, the invoice controller creates the cash purchase journal entry
  if (userId && !input.skipJournalEntry && !isPaid) {
    try {
      await createJournalEntry({
        date: new Date(input.bill_date),
        reference: input.bill_number,
        description: `Bill received: ${input.bill_number}`,
        entries: [
          {
            account_id: 'EXPENSE',
            account_name: 'Expense', // Can be customized based on bill type
            debit: input.total_amount,
            credit: 0,
          },
          {
            account_id: 'ACCOUNTS_PAYABLE',
            account_name: 'Accounts Payable',
            debit: 0,
            credit: input.total_amount,
          },
        ],
        createdBy: userId,
        source_module: 'payable',
        // Legacy fields for backward compatibility
        referenceType: 'Payable',
        referenceId: String(payable._id),
      })
    } catch (journalError: any) {
      // Log error but don't fail the payable creation
      console.error('Error creating journal entry for payable:', journalError)
    }
  }

  // For paid payables, create payment journal entry (only if not skipped)
  // Note: When skipJournalEntry is true, the invoice controller already created the purchase entry
  // so we should NOT create a duplicate payment entry here
  if (userId && isPaid && initialPayment && !input.skipJournalEntry) {
    try {
      // Get payment account mapping
      const paymentMapping = getPaymentAccountMapping(input.paymentMethod)
      
      // Calculate bank charges for card payments
      let bankCharges = 0
      let description = `Payment for bill: ${input.bill_number}${initialPayment.referenceNumber ? ` (Ref: ${initialPayment.referenceNumber})` : ''}`
      
      if (paymentMapping.bankChargesPercentage) {
        bankCharges = calculateBankCharges(initialPayment.amount, paymentMapping.bankChargesPercentage)
        description = formatJournalDescriptionWithBankCharges(initialPayment.amount, bankCharges, description)
      }
      
      // Note: Bank charges are shown in description but NOT added to the amounts
      // The debit/credit amounts remain the same as the payment amount
      await createJournalEntry({
        date: new Date(initialPayment.date),
        reference: initialPayment.referenceNumber || input.bill_number,
        description,
        entries: [
          {
            account_id: 'ACCOUNTS_PAYABLE',
            account_name: 'Accounts Payable',
            debit: initialPayment.amount,
            credit: 0,
          },
          {
            account_id: paymentMapping.account_id,
            account_name: paymentMapping.account_name,
            debit: 0,
            credit: initialPayment.amount,
          },
        ],
        createdBy: userId,
        source_module: 'payable',
        // Legacy fields for backward compatibility
        referenceType: 'Payable',
        referenceId: String(payable._id),
      })
    } catch (journalError: any) {
      console.error('Error creating journal entry for paid payable:', journalError)
    }
  }

  return payable
}

export async function listPayables(query?: {
  q?: string
  vendor_id?: string
  status?: string
  from?: string
  to?: string
}): Promise<IPayable[]> {
  const filter: FilterQuery<IPayable> = {}
  
  if (query?.q) {
    filter.$or = [
      { bill_number: new RegExp(query.q, 'i') },
      { notes: new RegExp(query.q, 'i') },
    ]
  }
  
  if (query?.vendor_id) {
    filter.vendor_id = query.vendor_id as any
  }
  
  if (query?.status) {
    filter.status = query.status
  }
  
  if (query?.from || query?.to) {
    filter.bill_date = {}
    if (query.from) (filter.bill_date as any).$gte = new Date(query.from)
    if (query.to) (filter.bill_date as any).$lte = new Date(query.to)
  }
  
  return Payable.find(filter)
    .populate('vendor_id')
    .sort({ bill_date: -1, createdAt: -1 })
}

export async function getPayableById(id: string): Promise<IPayable | null> {
  return Payable.findById(id).populate('vendor_id')
}

export async function updatePayableStatus(
  id: string,
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'
): Promise<IPayable | null> {
  return Payable.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  ).populate('vendor_id')
}

export async function updatePayable(
  id: string,
  updates: Partial<PayableInput>
): Promise<IPayable | null> {
  // Get existing payable to find its journal entries
  const existingPayable = await Payable.findById(id)
  if (!existingPayable) {
    return null
  }

  // Delete existing journal entries before updating
  try {
    const JournalEntry = (await import('../models/JournalEntry')).default
    const { deleteJournalEntry } = await import('./journalEntryService')
    
    // Find journal entries by referenceType and referenceId
    const journalEntries = await JournalEntry.find({
      $or: [
        { referenceType: 'Payable', referenceId: id },
        { source_module: 'payable', reference: existingPayable.bill_number },
      ]
    }).exec()

    // Delete all journal entries (this will also delete their GL entries)
    for (const journalEntry of journalEntries) {
      await deleteJournalEntry(String(journalEntry._id))
    }
  } catch (journalError: any) {
    console.error('Error deleting journal entries for payable update:', journalError)
    // Continue with payable update even if journal entry deletion fails
  }

  // Extract userId from updates if provided
  const userId = (updates as any).userId
  
  // Remove userId from updates before saving (it's not a field in the model)
  const { userId: _, ...updateFields } = updates as any
  
  // Update the payable
  const updatedPayable = await Payable.findByIdAndUpdate(id, updateFields, { new: true, runValidators: true })
  
  // Recreate journal entries if needed (only if payable is unpaid and not skipping)
  if (updatedPayable && !updates.skipJournalEntry && updatedPayable.status !== 'paid') {
    if (userId) {
      try {
        await createJournalEntry({
          date: new Date(updatedPayable.bill_date),
          reference: updatedPayable.bill_number,
          description: `Bill received: ${updatedPayable.bill_number}`,
          entries: [
            {
              account_id: 'EXPENSE',
              account_name: 'Expense', // Can be customized based on bill type
              debit: updatedPayable.total_amount,
              credit: 0,
            },
            {
              account_id: 'ACCOUNTS_PAYABLE',
              account_name: 'Accounts Payable',
              debit: 0,
              credit: updatedPayable.total_amount,
            },
          ],
          createdBy: userId,
          source_module: 'payable',
          referenceType: 'Payable',
          referenceId: String(updatedPayable._id),
        })
      } catch (journalError: any) {
        console.error('Error recreating journal entry for payable update:', journalError)
      }
    }
  }

  return updatedPayable
}

export async function recordPayment(
  id: string,
  payment: PaymentInput,
  userId?: string
): Promise<IPayable | null> {
  const payable = await Payable.findById(id)
  if (!payable) {
    throw new Error('Payable not found')
  }

  // Add payment
  payable.payments.push({
    ...payment,
    date: new Date(payment.date),
  } as IPayment)

  // Save to trigger pre-save hook for status calculation
  await payable.save()

  // Update linked purchase invoice payment status
  try {
    const purchaseInvoice = await PurchaseInvoice.findOne({ payable_id: payable._id })
    if (purchaseInvoice) {
      purchaseInvoice.payment_status = payable.status as any
      purchaseInvoice.balance_due = payable.balance_due
      await purchaseInvoice.save()
      console.log(`Updated purchase invoice ${purchaseInvoice.invoice_number} payment status to ${payable.status}`)
    }
  } catch (invoiceError: any) {
    // Log error but don't fail the payment recording
    console.error('Error updating linked purchase invoice:', invoiceError)
  }

  // Create journal entry: Debit Accounts Payable, Credit Cash/Bank
  if (userId) {
    try {
      // Get payment account mapping
      const paymentMapping = getPaymentAccountMapping(payment.paymentMethod)
      
      // Calculate bank charges for card payments
      let bankCharges = 0
      let description = `Payment for bill: ${payable.bill_number}${payment.referenceNumber ? ` (Ref: ${payment.referenceNumber})` : ''}`
      
      if (paymentMapping.bankChargesPercentage) {
        bankCharges = calculateBankCharges(payment.amount, paymentMapping.bankChargesPercentage)
        description = formatJournalDescriptionWithBankCharges(payment.amount, bankCharges, description)
      }
      
      // Note: Bank charges are shown in description but NOT added to the amounts
      // The debit/credit amounts remain the same as the payment amount
      await createJournalEntry({
        date: new Date(payment.date),
        reference: payment.referenceNumber || payable.bill_number,
        description,
        entries: [
          {
            account_id: 'ACCOUNTS_PAYABLE',
            account_name: 'Accounts Payable',
            debit: payment.amount,
            credit: 0,
          },
          {
            account_id: paymentMapping.account_id,
            account_name: paymentMapping.account_name,
            debit: 0,
            credit: payment.amount,
          },
        ],
        createdBy: userId,
        source_module: 'payable',
        // Legacy fields for backward compatibility
        referenceType: 'Payable',
        referenceId: String(payable._id),
      })
    } catch (journalError: any) {
      // Log error but don't fail the payment recording
      console.error('Error creating journal entry for payment:', journalError)
    }
  }

  return payable
}

export async function closePayable(id: string): Promise<IPayable | null> {
  const payable = await Payable.findById(id)
  if (!payable) {
    throw new Error('Payable not found')
  }

  // Calculate total payments
  const totalPaid = payable.payments.reduce((sum, payment) => sum + payment.amount, 0)
  
  if (totalPaid < payable.total_amount) {
    throw new Error('Cannot close payable: balance is not fully paid')
  }

  // Status will be automatically set to 'paid' by pre-save hook
  return payable.save()
}

export async function deletePayable(id: string): Promise<IPayable | null> {
  return Payable.findByIdAndDelete(id)
}
