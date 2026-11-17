import { Request, Response } from 'express'
import {
  createPaymentStatus,
  deletePaymentStatus,
  getPaymentStatusById,
  listPaymentStatuses,
  updatePaymentStatus,
} from '../services/paymentStatusService'

export const getPaymentStatuses = async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === 'true'
    const items = await listPaymentStatuses(activeOnly)
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const item = await getPaymentStatusById(req.params.id)
    if (!item) return res.status(404).json({ success: false, message: 'Payment status not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const createPaymentStatusEntry = async (req: Request, res: Response) => {
  try {
    const item = await createPaymentStatus(req.body)
    res.status(201).json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updatePaymentStatusEntry = async (req: Request, res: Response) => {
  try {
    const item = await updatePaymentStatus(req.params.id, req.body)
    if (!item) return res.status(404).json({ success: false, message: 'Payment status not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deletePaymentStatusEntry = async (req: Request, res: Response) => {
  try {
    const item = await deletePaymentStatus(req.params.id)
    if (!item) return res.status(404).json({ success: false, message: 'Payment status not found' })
    res.json({ success: true, message: 'Payment status deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

