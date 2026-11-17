import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createPayableEntry,
  deletePayableEntry,
  getPayable,
  getPayables,
  updatePayableEntry,
  updatePayableStatus,
  recordPaymentEntry,
  closePayableEntry,
} from '../controllers/payableController'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getPayables)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getPayable)
router.post('/', protect, authorize('admin', 'superadmin'), createPayableEntry)
router.put('/:id', protect, authorize('admin', 'superadmin'), updatePayableEntry)
router.patch('/:id/status', protect, authorize('admin', 'manager', 'superadmin'), updatePayableStatus)
router.post('/:id/payments', protect, authorize('admin', 'superadmin'), recordPaymentEntry)
router.post('/:id/close', protect, authorize('admin', 'superadmin'), closePayableEntry)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deletePayableEntry)

export default router

