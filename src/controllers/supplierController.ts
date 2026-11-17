import { Request, Response } from 'express'
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  listSuppliers,
  updateSupplier,
} from '../services/supplierService'

export const createSupplierEntry = async (req: Request, res: Response) => {
  try {
    const supplier = await createSupplier(req.body)
    res.status(201).json({ success: true, data: supplier })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const suppliers = await listSuppliers({
      q: req.query.q as string,
    })
    res.json({ success: true, data: suppliers })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getSupplier = async (req: Request, res: Response) => {
  try {
    const supplier = await getSupplierById(req.params.id)
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' })
    res.json({ success: true, data: supplier })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateSupplierEntry = async (req: Request, res: Response) => {
  try {
    const supplier = await updateSupplier(req.params.id, req.body)
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' })
    res.json({ success: true, data: supplier })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteSupplierEntry = async (req: Request, res: Response) => {
  try {
    const supplier = await deleteSupplier(req.params.id)
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' })
    res.json({ success: true, data: supplier })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


