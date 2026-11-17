import { Request, Response } from 'express'
import User from '../models/User'
import Auth from '../models/Auth'
import bcrypt from 'bcryptjs'
import { generateToken, verifyToken, generateResetToken } from '../utils/jwt'
import { sendPasswordResetEmail, sendPasswordChangedEmail } from '../utils/sendEmail'
import crypto from 'crypto'
import { AuthRequest } from '../middleware/auth'

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      })
    }

    // Look up auth credentials and linked user profile
    const auth = await Auth.findOne({ email }).select('+password').populate('user_profile')

    if (!auth || !auth.active) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      })
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, auth.password as string)
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      })
    }

    const userProfile = auth.user_profile as any

    // Check if profile is active
    if (!userProfile || !userProfile.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated',
      })
    }

    // Generate encrypted JWT token
    const token = generateToken({
      userId: userProfile.id,
      email: userProfile.email,
      role: userProfile.role,
    })

    res.status(200).json({
      success: true,
      token,
      user: {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
      },
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
}

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
}

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address',
      })
    }

    const auth = await Auth.findOne({ email })

    if (!auth) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If that email exists, a password reset link has been sent',
      })
    }

    // Generate reset token
    const resetToken = generateResetToken()

    // Hash token and set to resetToken field on Auth
    auth.resetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex')

    // Set expire (1 hour) on Auth
    auth.token_expiry = new Date(Date.now() + 60 * 60 * 1000)

    await auth.save({ validateBeforeSave: false })

    try {
      // Resolve user profile to pass name
      const userProfile = await User.findById(auth.user_profile)
      await sendPasswordResetEmail(auth.email, resetToken, userProfile?.name)

      res.status(200).json({
        success: true,
        message: 'If that email exists, a password reset link has been sent',
      })
    } catch (error) {
      auth.resetToken = undefined
      auth.token_expiry = undefined
      await auth.save({ validateBeforeSave: false })

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent',
      })
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
}

// @desc    Validate reset token
// @route   GET /api/auth/validate-reset-token
// @access  Public
export const validateResetToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.query

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing reset token',
      })
    }

    // Hash token and validate against Auth
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const auth = await Auth.findOne({
      resetToken: hashedToken,
      token_expiry: { $gt: Date.now() },
    })

    if (!auth) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Token is valid',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
}

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide token and password',
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      })
    }

    // Hash token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const auth = await Auth.findOne({
      resetToken: hashedToken,
      token_expiry: { $gt: Date.now() },
    }).select('+password')

    if (!auth) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      })
    }

    // Set new password
    const salt = await bcrypt.genSalt(10)
    auth.password = await bcrypt.hash(password, salt)
    auth.resetToken = undefined
    auth.token_expiry = undefined

    await auth.save()

    // Send password changed confirmation email
    try {
      const userProfile = await User.findById(auth.user_profile)
      await sendPasswordChangedEmail(auth.email, userProfile?.name)
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error('Error sending password changed email:', emailError)
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
}

