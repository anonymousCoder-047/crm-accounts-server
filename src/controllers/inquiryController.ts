import { Request, Response } from 'express'
import Inquiry from '../models/Inquiry'

export const getInquiries = async (req: Request, res: Response) => {
  try {
    const inquiries = await Inquiry.find().sort({ createdAt: -1 })
    res.json(inquiries)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const getInquiry = async (req: Request, res: Response) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' })
    }
    res.json(inquiry)
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

export const createInquiry = async (req: Request, res: Response) => {
  try {
    const inquiry = await Inquiry.create(req.body)
    res.status(201).json(inquiry)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const updateInquiry = async (req: Request, res: Response) => {
  try {
    const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' })
    }
    res.json(inquiry)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

export const deleteInquiry = async (req: Request, res: Response) => {
  try {
    const inquiry = await Inquiry.findByIdAndDelete(req.params.id)
    if (!inquiry) {
      return res.status(404).json({ message: 'Inquiry not found' })
    }
    res.json({ message: 'Inquiry deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ message: error.message })
  }
}

