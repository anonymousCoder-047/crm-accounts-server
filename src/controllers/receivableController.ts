import { Request, Response } from 'express'
import {
  createReceivable,
  deleteReceivable,
  getReceivableById,
  listReceivables,
  updateReceivable,
  updateReceivableStatus as updateReceivableStatusInService,
  recordPayment,
  closeReceivable,
} from '../services/receivableService'
import { getJournalEntriesByReference, deleteJournalEntry, createJournalEntry } from '../services/journalEntryService'

export const createReceivableEntry = async (req: Request, res: Response) => {
  try {
    const rec = await createReceivable(req.body, (req as any).user?.id)
    res.status(201).json({ success: true, data: rec })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getReceivables = async (req: Request, res: Response) => {
  try {
    const items = await listReceivables({
      q: req.query.q as string,
      customer_id: req.query.customer_id as string,
      status: req.query.status as string,
      from: req.query.from as string,
      to: req.query.to as string,
    })
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getReceivable = async (req: Request, res: Response) => {
  try {
    const rec = await getReceivableById(req.params.id)
    if (!rec) return res.status(404).json({ success: false, message: 'Receivable not found' })
    res.json({ success: true, data: rec })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateReceivableStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body as { status: 'unpaid' | 'partial' | 'paid' | 'overdue' }
    if (!status || !['unpaid', 'partial', 'paid', 'overdue'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be unpaid, partial, paid, or overdue' })
    }
    const rec = await updateReceivableStatusInService(req.params.id, status)
    if (!rec) return res.status(404).json({ success: false, message: 'Receivable not found' })
    res.json({ success: true, data: rec })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateReceivableEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    
    // Get existing receivable before update to find journal entries
    const existingReceivable = await getReceivableById(req.params.id)
    if (!existingReceivable) {
      return res.status(404).json({ success: false, message: 'Receivable not found' })
    }

    // Get receivable ID as string
    const receivableId = typeof existingReceivable._id === 'string' 
      ? existingReceivable._id 
      : (existingReceivable._id as any)?.toString()

    // Find and delete all related journal entries before updating
    if (receivableId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Receivable', receivableId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'receivable',
          reference: existingReceivable.invoice_number,
        }).exec()

        // Also find payment journal entries
        const paymentJournalEntries = await JournalEntry.find({
          source_module: 'receivable_payment',
          reference: existingReceivable.invoice_number,
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
        console.error('Error deleting journal entries for receivable update:', journalError)
        // Continue with receivable update even if journal entry deletion fails
      }
    }

    const rec = await updateReceivable(req.params.id, req.body)
    if (!rec) return res.status(404).json({ success: false, message: 'Receivable not found' })

    // Recreate journal entries based on updated receivable data
    if (userId) {
      try {
        const isPaid = rec.status === 'paid'

        if (!isPaid) {
          // Unpaid receivable: Debit Accounts Receivable, Credit Sales Revenue
          await createJournalEntry({
            date: new Date(rec.invoice_date),
            reference: rec.invoice_number,
            description: `Invoice issued: ${rec.invoice_number}`,
            entries: [
              {
                account_id: 'ACCOUNTS_RECEIVABLE',
                account_name: 'Accounts Receivable',
                debit: rec.total_amount,
                credit: 0,
              },
              {
                account_id: 'SALES_REVENUE',
                account_name: 'Sales Revenue',
                debit: 0,
                credit: rec.total_amount,
              },
            ],
            createdBy: userId,
            source_module: 'receivable',
            referenceType: 'Receivable',
            referenceId: String(rec._id),
          })
        } else if (isPaid && rec.payments && rec.payments.length > 0) {
          // Paid receivable: Create payment journal entry
          const payment = rec.payments[0]
          const paymentAccountId = payment.paymentMethod?.toLowerCase().includes('bank') ? 'BANK' : 'CASH'
          const paymentAccountName = payment.paymentMethod?.toLowerCase().includes('bank') ? 'Bank' : 'Cash'
          
          await createJournalEntry({
            date: new Date(payment.date),
            reference: payment.referenceNumber || rec.invoice_number,
            description: `Payment received for invoice: ${rec.invoice_number}${payment.referenceNumber ? ` (Ref: ${payment.referenceNumber})` : ''}`,
            entries: [
              {
                account_id: paymentAccountId,
                account_name: paymentAccountName,
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
            source_module: 'receivable',
            referenceType: 'Receivable',
            referenceId: String(rec._id),
          })
        }
      } catch (journalError: any) {
        console.error('Error recreating journal entries for receivable update:', journalError)
        // Continue even if journal entry recreation fails
      }
    }

    res.json({ success: true, data: rec })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const recordPaymentEntry = async (req: Request, res: Response) => {
  try {
    const receivable = await recordPayment(req.params.id, req.body, (req as any).user?.id)
    if (!receivable) return res.status(404).json({ success: false, message: 'Receivable not found' })
    res.json({ success: true, data: receivable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const closeReceivableEntry = async (req: Request, res: Response) => {
  try {
    const receivable = await closeReceivable(req.params.id)
    if (!receivable) return res.status(404).json({ success: false, message: 'Receivable not found' })
    res.json({ success: true, data: receivable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteReceivableEntry = async (req: Request, res: Response) => {
  try {
    // Get receivable before deletion to find related journal entries
    const receivable = await getReceivableById(req.params.id)
    if (!receivable) {
      return res.status(404).json({ success: false, message: 'Receivable not found' })
    }

    // Get receivable ID as string
    const receivableId = typeof receivable._id === 'string' 
      ? receivable._id 
      : (receivable._id as any)?.toString()

    // Find and delete all related journal entries
    // Journal entries are linked via referenceType: 'Receivable' and referenceId: receivable._id
    // or via source_module: 'receivable' and reference: receivable.invoice_number
    if (receivableId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Receivable', receivableId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'receivable',
          reference: receivable.invoice_number,
        }).exec()

        // Also find payment journal entries (source_module: 'receivable_payment')
        const paymentJournalEntries = await JournalEntry.find({
          source_module: 'receivable_payment',
          reference: receivable.invoice_number,
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
        console.error('Error deleting journal entries for receivable:', journalError)
        // Continue with receivable deletion even if journal entry deletion fails
      }
    }

    await deleteReceivable(req.params.id)
    res.json({ success: true, data: receivable })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}



