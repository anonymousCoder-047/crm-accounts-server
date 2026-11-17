import { Request, Response } from 'express'
import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from '../services/customerService'

export const createCustomerEntry = async (req: Request, res: Response) => {
  try {
    const customer = await createCustomer(req.body)
    res.status(201).json({ success: true, data: customer })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const customers = await listCustomers({
      q: req.query.q as string,
    })
    res.json({ success: true, data: customers })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getCustomer = async (req: Request, res: Response) => {
  try {
    const customer = await getCustomerById(req.params.id)
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })
    res.json({ success: true, data: customer })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateCustomerEntry = async (req: Request, res: Response) => {
  try {
    const customer = await updateCustomer(req.params.id, req.body)
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })
    res.json({ success: true, data: customer })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteCustomerEntry = async (req: Request, res: Response) => {
  try {
    const customer = await deleteCustomer(req.params.id)
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' })
    res.json({ success: true, data: customer })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

