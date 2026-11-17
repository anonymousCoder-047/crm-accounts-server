import { Router } from 'express'
import {
  createAuthDetails,
  getAuthDetailsByUser,
  getAuthDetailsByEmail,
  updateAuthDetails,
  markLastLogin,
  setResetTokenForAuth,
  setOtpForAuth,
  listAuthDetails,
} from '../controllers/authDetailsController'
import { authorize, protect } from '../middleware/auth'

const router = Router()

// Admin/superadmin create and list
router.post('/', protect, authorize('admin', 'manager', 'superadmin'), createAuthDetails)
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), listAuthDetails)

// Get by user profile
router.get('/user/:userId', protect, getAuthDetailsByUser)
// Get by email
router.get('/email/:email', protect, authorize('admin', 'manager', 'superadmin'), getAuthDetailsByEmail)

// Update
router.put('/:id', protect, authorize('admin', 'manager', 'superadmin'), updateAuthDetails)

// Mutations
router.post('/:id/last-login', protect, markLastLogin)
router.post('/:id/reset-token', protect, authorize('admin', 'manager', 'superadmin'), setResetTokenForAuth)
router.post('/:id/otp', protect, authorize('admin', 'manager', 'superadmin'), setOtpForAuth)

export default router


