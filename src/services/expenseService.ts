import Expense, { IExpense } from '../models/Expense'
import { FilterQuery, Types } from 'mongoose'
import { createJournalEntry } from './journalEntryService'
import { createPayable, PayableInput } from './payableService'
import { getAccountByAccountId } from './accountService'

export interface ExpenseInput {
  expense_id?: string
  category?: string
  vendor_id?: string
  amount?: number
  currency?: string
  expense_date?: Date | string
  payment_method?: string
  reference_number?: string
  tax_amount?: number
  description?: string
  attachments?: string[]
  associated_account?: string
  status?: string // Payment status (e.g., 'paid', 'unpaid', 'partial', etc.)
  payable_id?: string
  payment_terms?: string
  notes?: string
}

export async function createExpense(input: ExpenseInput, userId: string): Promise<IExpense> {
  // Generate expense_id if not provided
  const expenseId = input.expense_id || `EXP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  
  const totalAmount = (input.amount || 0) + (input.tax_amount || 0)
  
  // Create expense record
  const expense = await Expense.create({
    expense_id: expenseId,
    serialNumber: expenseId, // Set serialNumber to expense_id to satisfy unique index
    category: input.category || '',
    vendor_id: input.vendor_id,
    amount: input.amount || 0,
    currency: input.currency || 'AED',
    expense_date: input.expense_date ? new Date(input.expense_date) : new Date(),
    payment_method: input.payment_method,
    reference_number: input.reference_number,
    tax_amount: input.tax_amount || 0,
    description: input.description,
    attachments: input.attachments,
    created_by: userId,
    associated_account: input.associated_account || '',
    status: input.status || 'paid',
    payable_id: input.payable_id,
    payment_terms: input.payment_terms,
    notes: input.notes,
  })

  // Accounting Logic based on payment status
  // Treat any status that is not 'unpaid' (case-insensitive) as paid for accounting
  const isUnpaid = input.status?.toLowerCase() === 'unpaid'
  
  if (!isUnpaid) {
    // Paid immediately: Debit Expense Account, Credit Cash/Bank
    try {
      // Check if associated_account is an account_id (contains dashes) or account name
      let expenseAccountId = input.associated_account || 'EXPENSE'
      let expenseAccountName = input.category || 'Expense'
      
      // If it looks like an account_id (contains dashes), look up the account
      if (expenseAccountId.includes('-') && expenseAccountId.length > 10) {
        const account = await getAccountByAccountId(expenseAccountId)
        if (account) {
          expenseAccountId = account.account_id
          expenseAccountName = account.account_name
        } else {
          // If account not found, use the account_id as-is but try to get name from category
          expenseAccountName = input.category || expenseAccountId
        }
      } else {
        // It's an account name, convert to account_id format
        expenseAccountId = expenseAccountId.toUpperCase().replace(/\s+/g, '_')
        expenseAccountName = input.associated_account || input.category || 'Expense'
      }
      
      const paymentAccountId = input.payment_method === 'bank' ? 'BANK' : 'CASH'
      
      await createJournalEntry({
        date: input.expense_date ? new Date(input.expense_date) : new Date(),
        reference: expenseId,
        description: `Expense: ${expenseAccountName} (${expenseId})`,
        entries: [
          {
            account_id: expenseAccountId,
            account_name: expenseAccountName,
            debit: totalAmount,
            credit: 0,
          },
          {
            account_id: paymentAccountId,
            account_name: input.payment_method === 'bank' ? 'Bank' : 'Cash',
            debit: 0,
            credit: totalAmount,
          },
        ],
        createdBy: userId,
        source_module: 'expense',
        // Legacy fields for backward compatibility
        referenceType: 'Expense',
        referenceId: String(expense._id),
      })
    } catch (journalError: any) {
      console.error('Error creating journal entry for paid expense:', journalError)
      // Don't fail expense creation if journal entry fails
    }
  } else {
    // Unpaid: Debit Expense Account, Credit Accounts Payable
    // Create a Payable entry
    try {
      const payableInput: PayableInput = {
        vendor_id: input.vendor_id || '',
        bill_number: expenseId,
        bill_date: input.expense_date ? new Date(input.expense_date) : new Date(),
        due_date: input.expense_date ? new Date(input.expense_date) : new Date(), // Can be adjusted based on payment terms
        total_amount: totalAmount,
        tax_amount: input.tax_amount || 0,
        currency: input.currency || 'AED',
        notes: input.description,
      }
      
      const payable = await createPayable(payableInput, userId)
      
      // Update expense with payable reference
      expense.payable_id = payable._id as Types.ObjectId
      await expense.save()
      
      // Journal entry is created by createPayable, but we need to update it to use the correct expense account
      // Note: The payable service creates a generic "Expense" account entry
      // In a production system, you might want to update the journal entry or handle this differently
    } catch (payableError: any) {
      console.error('Error creating payable for unpaid expense:', payableError)
      // If payable creation fails, still create the expense but mark it as paid
      expense.status = 'paid'
      await expense.save()
      
      // Create journal entry as if it was paid
      try {
        const expenseAccountId = (input.associated_account || 'EXPENSE').toUpperCase().replace(/\s+/g, '_')
        
        await createJournalEntry({
          date: input.expense_date ? new Date(input.expense_date) : new Date(),
          reference: expenseId,
          description: `Expense: ${input.category || 'Uncategorized'} (${expenseId})`,
          entries: [
            {
              account_id: expenseAccountId,
              account_name: input.associated_account || 'Expense',
              debit: totalAmount,
              credit: 0,
            },
            {
              account_id: 'CASH',
              account_name: 'Cash',
              debit: 0,
              credit: totalAmount,
            },
          ],
          createdBy: userId,
          source_module: 'expense',
          // Legacy fields for backward compatibility
          referenceType: 'Expense',
          referenceId: String(expense._id),
        })
      } catch (journalError: any) {
        console.error('Error creating journal entry:', journalError)
      }
    }
  }

  return expense
}

export async function listExpenses(query?: {
  q?: string
  category?: string
  vendor_id?: string
  status?: string
  from?: string
  to?: string
}): Promise<IExpense[]> {
  const filter: FilterQuery<IExpense> = {}
  
  if (query?.q) {
    filter.$or = [
      { expense_id: new RegExp(query.q, 'i') },
      { description: new RegExp(query.q, 'i') },
      { category: new RegExp(query.q, 'i') },
      { reference_number: new RegExp(query.q, 'i') },
    ]
  }
  
  if (query?.category) filter.category = query.category
  if (query?.vendor_id) filter.vendor_id = query.vendor_id as any
  if (query?.status) filter.status = query.status
  
  if (query?.from || query?.to) {
    filter.expense_date = {}
    if (query.from) (filter.expense_date as any).$gte = new Date(query.from)
    if (query.to) (filter.expense_date as any).$lte = new Date(query.to)
  }
  
  return Expense.find(filter)
    .populate('vendor_id')
    .populate('created_by', 'name email')
    .populate('payable_id')
    .sort({ expense_date: -1, createdAt: -1 })
}

export async function getExpenseById(id: string): Promise<IExpense | null> {
  return Expense.findById(id)
    .populate('vendor_id')
    .populate('created_by', 'name email')
    .populate('payable_id')
}

export async function updateExpense(id: string, updates: Partial<ExpenseInput>, userId?: string): Promise<IExpense | null> {
  const expense = await Expense.findById(id)
  if (!expense) return null
  
  // If status changes from unpaid to paid, handle payment
  const wasUnpaid = expense.status?.toLowerCase() === 'unpaid'
  const isNowPaid = updates.status && updates.status.toLowerCase() !== 'unpaid'
  
  if (isNowPaid && wasUnpaid) {
    // This would trigger payment processing
    // For now, just update the status
    // In production, you'd want to record the payment and update the payable
  }
  
  const updatedExpense = await Expense.findByIdAndUpdate(
    id,
    {
      ...updates,
      expense_date: updates.expense_date ? new Date(updates.expense_date) : undefined,
    } as any,
    { new: true, runValidators: true }
  )
  
  return updatedExpense
}

export async function deleteExpense(id: string): Promise<IExpense | null> {
  return Expense.findByIdAndDelete(id)
}


