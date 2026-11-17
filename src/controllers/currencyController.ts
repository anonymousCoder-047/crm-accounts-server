import { Request, Response } from 'express'
import {
  createCurrency,
  deleteCurrency,
  getCurrencyById,
  listCurrencies,
  updateCurrency,
} from '../services/currencyService'

export const createCurrencyEntry = async (req: Request, res: Response) => {
  try {
    const currency = await createCurrency(req.body)
    res.status(201).json({ success: true, data: currency })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getCurrencies = async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === 'true'
    const items = await listCurrencies(activeOnly)
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getCurrency = async (req: Request, res: Response) => {
  try {
    const currency = await getCurrencyById(req.params.id)
    if (!currency) return res.status(404).json({ success: false, message: 'Currency not found' })
    res.json({ success: true, data: currency })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateCurrencyEntry = async (req: Request, res: Response) => {
  try {
    const currency = await updateCurrency(req.params.id, req.body)
    if (!currency) return res.status(404).json({ success: false, message: 'Currency not found' })
    res.json({ success: true, data: currency })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteCurrencyEntry = async (req: Request, res: Response) => {
  try {
    const currency = await deleteCurrency(req.params.id)
    if (!currency) return res.status(404).json({ success: false, message: 'Currency not found' })
    res.json({ success: true, data: currency })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


