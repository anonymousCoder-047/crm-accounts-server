import { Request, Response } from 'express'
import mongoose from 'mongoose'
import {
  createAuth,
  getAuthByEmail,
  getAuthByUserProfile,
  updateAuth,
  touchLastLogin,
  setResetToken,
  setOtp,
} from '../services/authService'
import Auth from '../models/Auth'

// @desc    Get auth details by email
// @route   GET /api/auth-details/email/:email
// @access  Admin/superadmin
export const getAuthDetailsByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.params
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'email is required',
      })
    }
    const auth = await getAuthByEmail(email)
    if (!auth) {
      return res.status(404).json({ success: false, message: 'Auth details not found' })
    }
    res.json({ success: true, data: auth })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Create auth details for a user
// @route   POST /api/auth-details
// @access  Admin/superadmin
export const createAuthDetails = async (req: Request, res: Response) => {
  try {
    const {
      username,
      email,
      password,
      user_profile,
      created_by,
      ip_address,
      country,
    } = req.body

    if (!username || !email || !password || !user_profile) {
      return res.status(400).json({
        success: false,
        message: 'username, email, password, and user_profile are required',
      })
    }

    const created = await createAuth({
      username,
      email,
      password,
      user_profile: new mongoose.Types.ObjectId(user_profile),
      created_by: created_by ? new mongoose.Types.ObjectId(created_by) : undefined,
      ip_address,
      country,
    })

    res.status(201).json({ success: true, data: created })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Get auth details by user_profile
// @route   GET /api/auth-details/user/:userId
// @access  Protected
export const getAuthDetailsByUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const auth = await getAuthByUserProfile(userId)
    if (!auth) {
      return res.status(404).json({ success: false, message: 'Auth details not found' })
    }
    res.json({ success: true, data: auth })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Update auth details
// @route   PUT /api/auth-details/:id
// @access  Admin/superadmin
export const updateAuthDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updates = req.body
    if (updates.updated_by) {
      updates.updated_by = new mongoose.Types.ObjectId(updates.updated_by)
    }
    const updated = await updateAuth(id, updates)
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Auth details not found' })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Mark last login and optionally update ip/country
// @route   POST /api/auth-details/:id/last-login
// @access  Protected
export const markLastLogin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { ip_address, country } = req.body
    const updated = await touchLastLogin(id, ip_address, country)
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Auth details not found' })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Set reset token and expiry
// @route   POST /api/auth-details/:id/reset-token
// @access  Admin/superadmin
export const setResetTokenForAuth = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { token, token_expiry } = req.body
    if (!token || !token_expiry) {
      return res.status(400).json({
        success: false,
        message: 'token and token_expiry are required',
      })
    }
    const updated = await setResetToken(id, token, new Date(token_expiry))
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Auth details not found' })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Set OTP (optionally with expiry)
// @route   POST /api/auth-details/:id/otp
// @access  Admin/superadmin
export const setOtpForAuth = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { otp, token_expiry } = req.body
    if (!otp) {
      return res.status(400).json({ success: false, message: 'otp is required' })
    }
    const updated = await setOtp(id, otp, token_expiry ? new Date(token_expiry) : undefined)
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Auth details not found' })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    List auth records (admin use)
// @route   GET /api/auth-details
// @access  Admin/superadmin
export const listAuthDetails = async (req: Request, res: Response) => {
  try {
    const { q, active } = req.query as { q?: string; active?: string }
    const filter: any = {}
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ]
    }
    if (active !== undefined) {
      filter.active = active === 'true'
    }
    const items = await Auth.find(filter).sort({ createdAt: -1 })
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


