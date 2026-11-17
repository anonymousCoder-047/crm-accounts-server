import { Router } from 'express'
import {
  createUserProfile,
  listUserProfiles,
  getUserProfile,
  updateUserProfile,
  deleteUserProfile,
} from '../controllers/userController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

router.post('/', protect, authorize('admin', 'manager', 'superadmin'), createUserProfile)
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), listUserProfiles)
router.get('/:id', protect, getUserProfile)
router.put('/:id', protect, authorize('admin', 'manager', 'superadmin'), updateUserProfile)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteUserProfile)

export default router


