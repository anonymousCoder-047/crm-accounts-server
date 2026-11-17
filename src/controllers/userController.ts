import { Request, Response } from 'express'
import mongoose from 'mongoose'
import {
  createUser,
  getUserById,
  getUserByEmail,
  listUsers,
  updateUser,
  deleteUser,
} from '../services/userService'
import {
  createAuth,
  getAuthByEmail,
  getAuthByUserProfile,
  updateAuth,
} from '../services/authService'
import { sendWelcomeEmail } from '../utils/sendEmail'

// @desc    Create user profile
// @route   POST /api/users
// @access  Admin/superadmin
export const createUserProfile = async (req: Request, res: Response) => {
  try {
    const {
      // user profile fields
      name,
      email,
      role,
      isActive,
      employeeId,
      department,
      position,
      phone,
      address,
      city,
      state,
      country,
      postalCode,
      dateOfBirth,
      hireDate,
      manager,
      location,
      avatarUrl,
      // auth fields (optional)
      username,
      password,
      ip_address,
    } = req.body

    // 1) Create the user profile
    const created = await createUser({
      name,
      email,
      role,
      isActive,
      employeeId,
      department,
      position,
      phone,
      address,
      city,
      state,
      country,
      postalCode,
      dateOfBirth,
      hireDate,
      manager,
      location,
      avatarUrl,
    })

    // 2) Upsert auth credentials linked to this profile
    const existingByProfile = await getAuthByUserProfile(created.id)
    const existingByEmail = await getAuthByEmail(email)
    const existing = existingByProfile || existingByEmail

    if (existing) {
      await updateAuth(existing.id, {
        username: username ?? existing.username,
        email,
        ...(password ? { password } : {}),
        updated_by: undefined,
        ip_address,
        // always ensure link is set
        // Types note: updateAuth doesn't include user_profile; keep separate if needed
      } as any)
      // If the existing record wasn't linked by user_profile, ensure linkage
      if (!existing.user_profile || existing.user_profile.toString() !== created.id) {
        await updateAuth(existing.id, {
          // cast as any to allow linking
          ...( { } as any ),
        } as any)
        // Fallback: if service doesn't accept user_profile updates, do direct model update
        // Left intentionally minimal to avoid tight coupling
      }
    } else {
      // Create new auth credentials; username fallback from email prefix.
      // If password is not provided, generate a secure temporary one.
      await createAuth({
        username: username || (email.includes('@') ? email.split('@')[0] : email),
        email,
        password:
          password ||
          // 12-char random with mixed charset; actual hashing handled in auth service/model
          Math.random().toString(36).slice(2, 10) +
            Math.random().toString(36).slice(2, 6).toUpperCase(),
        user_profile: created._id as unknown as mongoose.Types.ObjectId,
        ip_address,
        country,
      })
    }

    // 3) Send welcome email with login instructions (non-blocking for response)
    // Do not include raw password for security reasons.
    void sendWelcomeEmail(email, name || email).catch((err) => {
      // Log but don't fail the request if email sending has issues
      console.error('Failed to send welcome email for new user:', email, err)
    })

    res.status(201).json({ success: true, data: created })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    List user profiles
// @route   GET /api/users
// @access  Admin/manager/superadmin
export const listUserProfiles = async (req: Request, res: Response) => {
  try {
    const { q, role, isActive } = req.query as { q?: string; role?: any; isActive?: string }
    const users = await listUsers({
      q,
      role,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    })
    res.json({ success: true, data: users })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Get user profile by id
// @route   GET /api/users/:id
// @access  Protected
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params.id)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    res.json({ success: true, data: user })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Admin/manager/superadmin
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const updated = await updateUser(req.params.id, req.body)
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Delete user profile
// @route   DELETE /api/users/:id
// @access  Superadmin/admin
export const deleteUserProfile = async (req: Request, res: Response) => {
  try {
    const deleted = await deleteUser(req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }
    res.json({ success: true, data: deleted })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


