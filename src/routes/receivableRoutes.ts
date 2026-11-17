import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createReceivableEntry,
  deleteReceivableEntry,
  getReceivable,
  getReceivables,
  updateReceivableEntry,
  updateReceivableStatus,
  recordPaymentEntry,
  closeReceivableEntry,
} from '../controllers/receivableController'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getReceivables)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getReceivable)
router.post('/', protect, authorize('admin', 'superadmin'), createReceivableEntry)
router.put('/:id', protect, authorize('admin', 'superadmin'), updateReceivableEntry)
router.patch('/:id/status', protect, authorize('admin', 'manager', 'superadmin'), updateReceivableStatus)
router.post('/:id/payments', protect, authorize('admin', 'superadmin'), recordPaymentEntry)
router.post('/:id/close', protect, authorize('admin', 'superadmin'), closeReceivableEntry)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteReceivableEntry)

export default router



