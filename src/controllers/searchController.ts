import { Request, Response } from 'express'
import { globalSearch } from '../services/searchService'
import { AuthRequest } from '../middleware/auth'

export const searchHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { q, limit } = req.query
    const query = q as string
    const resultLimit = limit ? parseInt(limit as string, 10) : 10

    if (!query || query.trim().length < 2) {
      return res.json({ success: true, data: [] })
    }

    const results = await globalSearch(query, resultLimit)

    res.json({ success: true, data: results })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


