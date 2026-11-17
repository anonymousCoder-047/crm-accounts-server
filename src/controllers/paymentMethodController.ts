import { Request, Response } from 'express'
import {
  createPaymentMethod,
  deletePaymentMethod,
  getPaymentMethodById,
  listPaymentMethods,
  updatePaymentMethod,
} from '../services/paymentMethodService'

export const getPaymentMethods = async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === 'true'
    const items = await listPaymentMethods(activeOnly)
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getPaymentMethod = async (req: Request, res: Response) => {
  try {
    const item = await getPaymentMethodById(req.params.id)
    if (!item) return res.status(404).json({ success: false, message: 'Payment method not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const createPaymentMethodEntry = async (req: Request, res: Response) => {
  try {
    const item = await createPaymentMethod(req.body)
    res.status(201).json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updatePaymentMethodEntry = async (req: Request, res: Response) => {
  try {
    const item = await updatePaymentMethod(req.params.id, req.body)
    if (!item) return res.status(404).json({ success: false, message: 'Payment method not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deletePaymentMethodEntry = async (req: Request, res: Response) => {
  try {
    const item = await deletePaymentMethod(req.params.id)
    if (!item) return res.status(404).json({ success: false, message: 'Payment method not found' })
    res.json({ success: true, message: 'Payment method deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


