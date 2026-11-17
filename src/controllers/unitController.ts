import { Request, Response } from 'express'
import {
  createUnit,
  deleteUnit,
  getUnitById,
  listUnits,
  updateUnit,
} from '../services/unitService'

export const createUnitEntry = async (req: Request, res: Response) => {
  try {
    const unit = await createUnit(req.body)
    res.status(201).json({ success: true, data: unit })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getUnits = async (req: Request, res: Response) => {
  try {
    const units = await listUnits({
      q: req.query.q as string,
    })
    res.json({ success: true, data: units })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getUnit = async (req: Request, res: Response) => {
  try {
    const unit = await getUnitById(req.params.id)
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' })
    res.json({ success: true, data: unit })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateUnitEntry = async (req: Request, res: Response) => {
  try {
    const unit = await updateUnit(req.params.id, req.body)
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' })
    res.json({ success: true, data: unit })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteUnitEntry = async (req: Request, res: Response) => {
  try {
    const unit = await deleteUnit(req.params.id)
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' })
    res.json({ success: true, data: unit })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

