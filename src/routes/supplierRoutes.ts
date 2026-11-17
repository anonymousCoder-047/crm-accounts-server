import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createSupplierEntry,
  deleteSupplierEntry,
  getSupplier,
  getSuppliers,
  updateSupplierEntry,
} from '../controllers/supplierController'

const router = Router()

router.post('/', protect, authorize('admin', 'manager', 'superadmin'), createSupplierEntry)
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getSuppliers)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getSupplier)
router.put('/:id', protect, authorize('admin', 'manager', 'superadmin'), updateSupplierEntry)
router.delete('/:id', protect, authorize('admin', 'manager', 'superadmin'), deleteSupplierEntry)

export default router


