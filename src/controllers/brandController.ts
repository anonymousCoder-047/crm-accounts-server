import { Request, Response } from 'express'
import {
  createBrand,
  deleteBrand,
  getBrandById,
  listBrands,
  updateBrand,
} from '../services/brandService'

export const createBrandEntry = async (req: Request, res: Response) => {
  try {
    const brand = await createBrand(req.body)
    res.status(201).json({ success: true, data: brand })
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Brand name already exists' })
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getBrands = async (req: Request, res: Response) => {
  try {
    const brands = await listBrands({
      q: req.query.q as string,
    })
    res.json({ success: true, data: brands })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getBrand = async (req: Request, res: Response) => {
  try {
    const brand = await getBrandById(req.params.id)
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' })
    res.json({ success: true, data: brand })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateBrandEntry = async (req: Request, res: Response) => {
  try {
    const brand = await updateBrand(req.params.id, req.body)
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' })
    res.json({ success: true, data: brand })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteBrandEntry = async (req: Request, res: Response) => {
  try {
    const brand = await deleteBrand(req.params.id)
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' })
    res.json({ success: true, data: brand })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


