import { Request, Response } from 'express'
import { AccountingEngine } from '../services/accountingEngine'

export const postAccountingEvent = async (req: Request, res: Response) => {
  try {
    const { type, payload } = req.body

    if (!type || !payload) {
      return res.status(400).json({
        success: false,
        message: 'type and payload are required',
      })
    }

    // Attach authenticated user as createdBy if not provided
    const userId = (req as any).user?.id
    if (userId && !payload.createdBy) {
      payload.createdBy = userId
    }

    const result = await AccountingEngine.post({ type, payload } as any)

    return res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to post accounting event',
    })
  }
}



