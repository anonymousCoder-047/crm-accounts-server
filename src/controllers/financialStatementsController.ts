import { Request, Response } from 'express'
import {
  generateIncomeStatement,
  generateBalanceSheet,
  generateCashFlowStatement,
  generateStatementOfEquity,
  generateTrialBalanceForStatements,
} from '../services/financialStatementsService'

export const getIncomeStatement = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required',
      })
    }

    const statement = await generateIncomeStatement({
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    })

    res.json({ success: true, data: statement })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getBalanceSheet = async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date()

    const statement = await generateBalanceSheet(startDate, endDate)

    res.json({ success: true, data: statement })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getCashFlowStatement = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required',
      })
    }

    const statement = await generateCashFlowStatement({
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    })

    res.json({ success: true, data: statement })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getStatementOfEquity = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate query parameters are required',
      })
    }

    const statement = await generateStatementOfEquity({
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    })

    res.json({ success: true, data: statement })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getTrialBalance = async (req: Request, res: Response) => {
  try {
    const asOfDate = req.query.asOfDate
      ? new Date(req.query.asOfDate as string)
      : undefined

    const trialBalance = await generateTrialBalanceForStatements(asOfDate || new Date())

    res.json({ success: true, data: trialBalance })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

