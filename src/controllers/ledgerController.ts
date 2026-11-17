import { Request, Response } from 'express'
import {
  getAccountLedger,
  listLedgerEntries,
  generateTrialBalance,
  getDateRangeSummary,
  getAllAccounts,
  getLedgerEntryById,
  updateLedgerEntry,
  deleteLedgerEntry,
  bulkDeleteLedgerEntries,
} from '../services/ledgerService'

export const getLedgerEntries = async (req: Request, res: Response) => {
  try {
    const filters: any = {}

    if (req.query.account_id) {
      filters.account_id = req.query.account_id as string
    }
    if (req.query.account_name) {
      filters.account_name = req.query.account_name as string
    }
    if (req.query.account_type) {
      filters.account_type = req.query.account_type
    }
    if (req.query.startDate) {
      // Set to start of day (00:00:00) to include all entries from that day
      const startDateStr = req.query.startDate as string
      filters.startDate = new Date(startDateStr + 'T00:00:00.000Z')
    }
    if (req.query.endDate) {
      // Set to end of day (23:59:59.999) to include all entries from that day
      const endDateStr = req.query.endDate as string
      filters.endDate = new Date(endDateStr + 'T23:59:59.999Z')
    }
    if (req.query.source_module) {
      filters.source_module = req.query.source_module as string
    }

    const entries = await listLedgerEntries(filters)

    res.json({ success: true, data: entries })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAccountLedgerHandler = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params
    const filters: any = {}

    if (req.query.startDate) {
      // Set to start of day (00:00:00) to include all entries from that day
      const startDateStr = req.query.startDate as string
      filters.startDate = new Date(startDateStr + 'T00:00:00.000Z')
    }
    if (req.query.endDate) {
      // Set to end of day (23:59:59.999) to include all entries from that day
      const endDateStr = req.query.endDate as string
      filters.endDate = new Date(endDateStr + 'T23:59:59.999Z')
    }

    const ledger = await getAccountLedger(accountId, filters)

    res.json({ success: true, data: ledger })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getTrialBalance = async (req: Request, res: Response) => {
  try {
    const asOfDate = req.query.asOfDate
      ? new Date(req.query.asOfDate as string)
      : undefined

    const trialBalance = await generateTrialBalance(asOfDate)

    res.json({ success: true, data: trialBalance })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getDateRangeSummaryHandler = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required',
      })
    }

    const summary = await getDateRangeSummary(
      new Date(startDate as string),
      new Date(endDate as string)
    )

    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await getAllAccounts()

    res.json({ success: true, data: accounts })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getLedgerEntry = async (req: Request, res: Response) => {
  try {
    const entry = await getLedgerEntryById(req.params.id)

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    }

    res.json({ success: true, data: entry })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateLedgerEntryHandler = async (req: Request, res: Response) => {
  try {
    const entry = await updateLedgerEntry(req.params.id, req.body)

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    }

    res.json({ success: true, data: entry, message: 'Ledger entry updated successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteLedgerEntryHandler = async (req: Request, res: Response) => {
  try {
    const entry = await deleteLedgerEntry(req.params.id)

    if (!entry) {
      return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    }

    res.json({ success: true, message: 'Ledger entry deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const bulkDeleteLedgerEntriesHandler = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ids must be a non-empty array of ledger entry IDs',
      })
    }

    const result = await bulkDeleteLedgerEntries(ids)

    if (result.errors.length > 0 && result.deletedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to delete ledger entries',
        errors: result.errors,
      })
    }

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} ledger entry/entries`,
      data: {
        deletedCount: result.deletedCount,
        errors: result.errors,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

