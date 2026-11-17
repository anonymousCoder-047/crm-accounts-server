import express from 'express'
import {
  login,
  getMe,
  forgotPassword,
  resetPassword,
  validateResetToken,
} from '../controllers/authController'
import { protect } from '../middleware/auth'

const router = express.Router()

router.post('/login', login)
router.get('/me', protect, getMe)
router.post('/forgot-password', forgotPassword)
router.get('/validate-reset-token', validateResetToken)
router.post('/reset-password', resetPassword)

export default router

