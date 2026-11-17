import { Request, Response } from 'express'
import {
  createPayable,
  deletePayable,
  getPayableById,
  listPayables,
  updatePayable,
  updatePayableStatus as updatePayableStatusInService,
  recordPayment,
  closePayable,
} from '../services/payableService'
import { getJournalEntriesByReference, deleteJournalEntry, createJournalEntry } from '../services/journalEntryService'

export const createPayableEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const payable = await createPayable(req.body, userId)
    res.status(201).json({ success: true, data: payable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getPayables = async (req: Request, res: Response) => {
  try {
    const items = await listPayables({
      q: req.query.q as string,
      vendor_id: req.query.vendor_id as string,
      status: req.query.status as string,
      from: req.query.from as string,
      to: req.query.to as string,
    })
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getPayable = async (req: Request, res: Response) => {
  try {
    const payable = await getPayableById(req.params.id)
    if (!payable) return res.status(404).json({ success: false, message: 'Payable not found' })
    res.json({ success: true, data: payable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updatePayableStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: 'unpaid' | 'partial' | 'paid' | 'overdue' }
    if (!status || !['unpaid', 'partial', 'paid', 'overdue'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be unpaid, partial, paid, or overdue' })
    }
    const payable = await updatePayableStatusInService(req.params.id, status)
    if (!payable) return res.status(404).json({ success: false, message: 'Payable not found' })
    res.json({ success: true, data: payable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updatePayableEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    
    // Get existing payable before update to find journal entries
    const existingPayable = await getPayableById(req.params.id)
    if (!existingPayable) {
      return res.status(404).json({ success: false, message: 'Payable not found' })
    }

    // Get payable ID as string
    const payableId = typeof existingPayable._id === 'string' 
      ? existingPayable._id 
      : (existingPayable._id as any)?.toString()

    // Find and delete all related journal entries before updating
    if (payableId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Payable', payableId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'payable',
          reference: existingPayable.bill_number,
        }).exec()

        // Also find payment journal entries
        const paymentJournalEntries = await JournalEntry.find({
          source_module: 'payable_payment',
          reference: existingPayable.bill_number,
        }).exec()

        // Combine and deduplicate journal entries
        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesBySource.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        paymentJournalEntries.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for payable update:', journalError)
        // Continue with payable update even if journal entry deletion fails
      }
    }

    const payable = await updatePayable(req.params.id, req.body)
    if (!payable) return res.status(404).json({ success: false, message: 'Payable not found' })

    // Recreate journal entries based on updated payable data
    if (userId) {
      try {
        const isPaid = payable.status === 'paid'

        if (!isPaid) {
          // Unpaid payable: Debit Expense, Credit Accounts Payable
          await createJournalEntry({
            date: new Date(payable.bill_date),
            reference: payable.bill_number,
            description: `Bill received: ${payable.bill_number}`,
            entries: [
              {
                account_id: 'EXPENSE',
                account_name: 'Expense',
                debit: payable.total_amount,
                credit: 0,
              },
              {
                account_id: 'ACCOUNTS_PAYABLE',
                account_name: 'Accounts Payable',
                debit: 0,
                credit: payable.total_amount,
              },
            ],
            createdBy: userId,
            source_module: 'payable',
            referenceType: 'Payable',
            referenceId: String(payable._id),
          })
        } else if (isPaid && payable.payments && payable.payments.length > 0) {
          // Paid payable: Create payment journal entry
          const payment = payable.payments[0]
          const paymentAccountId = payment.paymentMethod?.toLowerCase().includes('bank') ? 'BANK' : 'CASH'
          const paymentAccountName = payment.paymentMethod?.toLowerCase().includes('bank') ? 'Bank' : 'Cash'
          
          await createJournalEntry({
            date: new Date(payment.date),
            reference: payment.referenceNumber || payable.bill_number,
            description: `Payment for bill: ${payable.bill_number}${payment.referenceNumber ? ` (Ref: ${payment.referenceNumber})` : ''}`,
            entries: [
              {
                account_id: 'ACCOUNTS_PAYABLE',
                account_name: 'Accounts Payable',
                debit: payment.amount,
                credit: 0,
              },
              {
                account_id: paymentAccountId,
                account_name: paymentAccountName,
                debit: 0,
                credit: payment.amount,
              },
            ],
            createdBy: userId,
            source_module: 'payable',
            referenceType: 'Payable',
            referenceId: String(payable._id),
          })
        }
      } catch (journalError: any) {
        console.error('Error recreating journal entries for payable update:', journalError)
        // Continue even if journal entry recreation fails
      }
    }

    res.json({ success: true, data: payable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const recordPaymentEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const payable = await recordPayment(req.params.id, req.body, userId)
    if (!payable) return res.status(404).json({ success: false, message: 'Payable not found' })
    res.json({ success: true, data: payable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const closePayableEntry = async (req: Request, res: Response) => {
  try {
    const payable = await closePayable(req.params.id)
    if (!payable) return res.status(404).json({ success: false, message: 'Payable not found' })
    res.json({ success: true, data: payable })
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deletePayableEntry = async (req: Request, res: Response) => {
  try {
    // Get payable before deletion to find related journal entries
    const payable = await getPayableById(req.params.id)
    if (!payable) {
      return res.status(404).json({ success: false, message: 'Payable not found' })
    }

    // Get payable ID as string
    const payableId = typeof payable._id === 'string' 
      ? payable._id 
      : (payable._id as any)?.toString()

    // Find and delete all related journal entries
    // Journal entries are linked via referenceType: 'Payable' and referenceId: payable._id
    // or via source_module: 'payable' and reference: payable.bill_number
    if (payableId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Payable', payableId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'payable',
          reference: payable.bill_number,
        }).exec()

        // Also find payment journal entries (source_module: 'payable_payment')
        const paymentJournalEntries = await JournalEntry.find({
          source_module: 'payable_payment',
          reference: payable.bill_number,
        }).exec()

        // Combine and deduplicate journal entries
        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesBySource.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        paymentJournalEntries.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for payable:', journalError)
        // Continue with payable deletion even if journal entry deletion fails
      }
    }

    await deletePayable(req.params.id)
    res.json({ success: true, data: payable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}
