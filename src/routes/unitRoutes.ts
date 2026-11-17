import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createUnitEntry,
  deleteUnitEntry,
  getUnit,
  getUnits,
  updateUnitEntry,
} from '../controllers/unitController'

const router = Router()

router.post('/', protect, authorize('admin', 'manager', 'superadmin'), createUnitEntry)
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getUnits)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getUnit)
router.put('/:id', protect, authorize('admin', 'manager', 'superadmin'), updateUnitEntry)
router.delete('/:id', protect, authorize('admin', 'manager', 'superadmin'), deleteUnitEntry)

export default router

