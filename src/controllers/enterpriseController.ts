import { Request, Response } from 'express'
import Enterprise from '../models/Enterprise'

export const getEnterprises = async (req: Request, res: Response) => {
  try {
    const enterprises = await Enterprise.find().sort({ createdAt: -1 })
    res.json(enterprises)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getEnterprise = async (req: Request, res: Response) => {
  try {
    const enterprise = await Enterprise.findById(req.params.id)
    if (!enterprise) {
      return res.status(404).json({ message: 'Enterprise not found' })
    }
    res.json(enterprise)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const createEnterprise = async (req: Request, res: Response) => {
  try {
    const enterprise = await Enterprise.create(req.body)
    res.status(201).json(enterprise)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const updateEnterprise = async (req: Request, res: Response) => {
  try {
    const enterprise = await Enterprise.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!enterprise) {
      return res.status(404).json({ message: 'Enterprise not found' })
    }
    res.json(enterprise)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const deleteEnterprise = async (req: Request, res: Response) => {
  try {
    const enterprise = await Enterprise.findByIdAndDelete(req.params.id)
    if (!enterprise) {
      return res.status(404).json({ message: 'Enterprise not found' })
    }
    res.json({ message: 'Enterprise deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

