import { Request, Response } from 'express'
import {
  createAuditTrail,
  deleteAuditTrail,
  getAuditTrailById,
  listAuditTrails,
  deleteOldAuditTrails,
  getAuditTrailStats,
} from '../services/auditTrailService'

export const createAuditTrailEntry = async (req: Request, res: Response) => {
  try {
    const auditTrail = await createAuditTrail(req.body)
    res.status(201).json({ success: true, data: auditTrail })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAuditTrails = async (req: Request, res: Response) => {
  try {
    const {
      type,
      errorType,
      userId,
      path,
      method,
      from,
      to,
      q,
      limit,
      skip,
    } = req.query

    const result = await listAuditTrails({
      type: type as any,
      errorType: errorType as any,
      userId: userId as string,
      path: path as string,
      method: method as string,
      from: from as string,
      to: to as string,
      q: q as string,
      limit: limit ? parseInt(limit as string) : undefined,
      skip: skip ? parseInt(skip as string) : undefined,
    })

    res.status(200).json({ success: true, ...result })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAuditTrail = async (req: Request, res: Response) => {
  try {
    const auditTrail = await getAuditTrailById(req.params.id)
    if (!auditTrail) {
      return res.status(404).json({ success: false, message: 'Audit trail not found' })
    }
    res.status(200).json({ success: true, data: auditTrail })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteAuditTrailEntry = async (req: Request, res: Response) => {
  try {
    const auditTrail = await deleteAuditTrail(req.params.id)
    if (!auditTrail) {
      return res.status(404).json({ success: false, message: 'Audit trail not found' })
    }
    res.status(200).json({ success: true, message: 'Audit trail deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const cleanupOldAuditTrails = async (req: Request, res: Response) => {
  try {
    const daysToKeep = req.body.daysToKeep || 90
    const deletedCount = await deleteOldAuditTrails(daysToKeep)
    res.status(200).json({
      success: true,
      message: `Deleted ${deletedCount} old audit trail entries`,
      deletedCount,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAuditTrailStatistics = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query
    const stats = await getAuditTrailStats(
      from ? new Date(from as string) : undefined,
      to ? new Date(to as string) : undefined
    )
    res.status(200).json({ success: true, data: stats })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

