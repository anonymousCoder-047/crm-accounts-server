import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import User from '../models/User'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Superadmin global bypass (optional). Enable via env.
    const superAdminBypass =
      process.env.SUPER_ADMIN_BYPASS === 'true' &&
      req.headers['x-superadmin-email'] &&
      String(req.headers['x-superadmin-email']).toLowerCase() ===
        String(process.env.SUPER_ADMIN_EMAIL || '').toLowerCase()

    if (superAdminBypass) {
      req.user = {
        id: 'superadmin-bypass',
        email: String(process.env.SUPER_ADMIN_EMAIL),
        role: 'superadmin',
      }
      return next()
    }

    let token: string | undefined

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      })
    }

    try {
      // Verify and decrypt token
      const decoded = verifyToken(token)

      // Get user from database
      const user = await User.findById(decoded.userId).select('-password')

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive',
        })
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      }

      next()
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        message: error.message || 'Not authorized to access this route',
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
    })
  }
}

// Role-based authorization
// Superadmin has access to all routes regardless of role requirements
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      })
    }

    // Superadmin has all permissions
    if (req.user.role === 'superadmin') {
      return next()
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      })
    }

    next()
  }
}

/**
 * Check if user is superadmin
 */
export const isSuperAdmin = (role: string): boolean => {
  return role === 'superadmin'
}

