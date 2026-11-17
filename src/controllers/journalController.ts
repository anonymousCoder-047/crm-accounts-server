import { Request, Response } from 'express'
import { createJournal, getJournalById, listJournals, reverseJournal } from '../services/journalService'

export const createJournalHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const journal = await createJournal({
      ...req.body,
      createdBy: userId,
    })

    res.status(201).json({ success: true, data: journal })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create journal',
    })
  }
}

export const reverseJournalHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { journalId } = req.params
    const { date, descriptionOverride } = req.body || {}

    const reversal = await reverseJournal(journalId, userId, {
      date: date ? new Date(date) : undefined,
      descriptionOverride,
    })

    res.status(201).json({ success: true, data: reversal })
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to reverse journal',
    })
  }
}

export const getJournalHandler = async (req: Request, res: Response) => {
  try {
    const { journalId } = req.params
    const journal = await getJournalById(journalId)
    if (!journal) {
      return res.status(404).json({ success: false, message: 'Journal not found' })
    }
    res.json({ success: true, data: journal })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const listJournalsHandler = async (req: Request, res: Response) => {
  try {
    const filters: any = {}
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string)
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string)
    if (req.query.source_module) filters.source_module = req.query.source_module
    if (req.query.account_id) filters.account_id = req.query.account_id
    if (req.query.reference_id) filters.reference_id = req.query.reference_id

    const journals = await listJournals(filters)
    res.json({ success: true, data: journals })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}



