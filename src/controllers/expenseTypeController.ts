import { Request, Response } from 'express'
import {
  createExpenseType,
  deleteExpenseType,
  getExpenseTypeById,
  listExpenseTypes,
  updateExpenseType,
} from '../services/expenseTypeService'

export const createExpenseTypeEntry = async (req: Request, res: Response) => {
  try {
    const expenseType = await createExpenseType(req.body)
    res.status(201).json({ success: true, data: expenseType })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getExpenseTypes = async (req: Request, res: Response) => {
  try {
    const expenseTypes = await listExpenseTypes({
      q: req.query.q as string,
    })
    res.json({ success: true, data: expenseTypes })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getExpenseType = async (req: Request, res: Response) => {
  try {
    const expenseType = await getExpenseTypeById(req.params.id)
    if (!expenseType) return res.status(404).json({ success: false, message: 'Expense type not found' })
    res.json({ success: true, data: expenseType })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateExpenseTypeEntry = async (req: Request, res: Response) => {
  try {
    const expenseType = await updateExpenseType(req.params.id, req.body)
    if (!expenseType) return res.status(404).json({ success: false, message: 'Expense type not found' })
    res.json({ success: true, data: expenseType })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteExpenseTypeEntry = async (req: Request, res: Response) => {
  try {
    const expenseType = await deleteExpenseType(req.params.id)
    if (!expenseType) return res.status(404).json({ success: false, message: 'Expense type not found' })
    res.json({ success: true, data: expenseType })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

