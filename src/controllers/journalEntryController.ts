import { Request, Response } from 'express'
import {
  createJournalEntry,
  listJournalEntries,
  getJournalEntryById,
  getJournalEntriesByReference,
  deleteJournalEntry,
  updateJournalEntry,
  regenerateLedgerFromJournals,
  bulkDeleteJournalEntries,
  findAndRemoveDuplicateJournalEntries,
} from '../services/journalEntryService'

export const getJournalEntries = async (req: Request, res: Response) => {
  try {
    const filters: any = {}

    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string)
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string)
    }
    if (req.query.referenceType) {
      filters.referenceType = req.query.referenceType
    }
    if (req.query.source_module) {
      filters.source_module = req.query.source_module
    }
    if (req.query.account) {
      filters.account = req.query.account as string
    }
    if (req.query.account_id) {
      filters.account_id = req.query.account_id as string
    }

    const userId = (req as any).user?.id
    const entries = await listJournalEntries(filters, userId)

    res.json({ success: true, data: entries })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const createJournalEntryHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const entry = await createJournalEntry({
      ...req.body,
      createdBy: userId,
    })

    res.status(201).json({ success: true, data: entry })
  } catch (error: any) {
    if (error.message.includes('debit') && error.message.includes('credit')) {
      return res.status(400).json({ success: false, message: error.message })
    }
    if (error.message.includes('not found')) {
      return res.status(404).json({ success: false, message: error.message })
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateJournalEntryHandler = async (req: Request, res: Response) => {
  try {
    const entry = await updateJournalEntry(req.params.id, req.body)

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Journal entry not found' })
    }

    res.json({ success: true, data: entry })
  } catch (error: any) {
    if (error.message.includes('debit') && error.message.includes('credit')) {
      return res.status(400).json({ success: false, message: error.message })
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getJournalEntry = async (req: Request, res: Response) => {
  try {
    const entry = await getJournalEntryById(req.params.id)

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Journal entry not found' })
    }

    res.json({ success: true, data: entry })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getJournalEntriesByRef = async (req: Request, res: Response) => {
  try {
    const { referenceType, referenceId } = req.params

    if (!['Sales', 'Purchase', 'Expense', 'Inventory', 'Payable', 'Receivable'].includes(referenceType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reference type. Must be Sales, Purchase, Expense, Inventory, Payable, or Receivable',
      })
    }

    const entries = await getJournalEntriesByReference(
      referenceType as 'Sales' | 'Purchase' | 'Expense' | 'Inventory' | 'Payable' | 'Receivable',
      referenceId
    )

    res.json({ success: true, data: entries })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteJournalEntryHandler = async (req: Request, res: Response) => {
  try {
    const entry = await deleteJournalEntry(req.params.id)

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Journal entry not found' })
    }

    res.json({ success: true, message: 'Journal entry deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const regenerateLedgerHandler = async (req: Request, res: Response) => {
  try {
    const result = await regenerateLedgerFromJournals()
    res.json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const bulkDeleteJournalEntriesHandler = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ids must be a non-empty array of journal entry IDs',
      })
    }

    const result = await bulkDeleteJournalEntries(ids)

    if (result.errors.length > 0 && result.deletedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to delete journal entries',
        errors: result.errors,
      })
    }

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} journal entry/entries`,
      data: {
        deletedCount: result.deletedCount,
        errors: result.errors,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const removeDuplicateJournalEntriesHandler = async (req: Request, res: Response) => {
  try {
    const result = await findAndRemoveDuplicateJournalEntries()
    
    res.json({
      success: true,
      message: `Found ${result.duplicatesFound} duplicate(s), removed ${result.duplicatesRemoved}`,
      data: result,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

