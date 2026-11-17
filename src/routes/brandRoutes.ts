import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createBrandEntry,
  deleteBrandEntry,
  getBrand,
  getBrands,
  updateBrandEntry,
} from '../controllers/brandController'

const router = Router()

router.post('/', protect, authorize('admin', 'manager', 'superadmin'), createBrandEntry)
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getBrands)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getBrand)
router.put('/:id', protect, authorize('admin', 'manager', 'superadmin'), updateBrandEntry)
router.delete('/:id', protect, authorize('admin', 'manager', 'superadmin'), deleteBrandEntry)

export default router


