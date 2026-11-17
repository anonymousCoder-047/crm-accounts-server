import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createPaymentStatusEntry,
  deletePaymentStatusEntry,
  getPaymentStatus,
  getPaymentStatuses,
  updatePaymentStatusEntry,
} from '../controllers/paymentStatusController'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getPaymentStatuses)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getPaymentStatus)
router.post('/', protect, authorize('admin', 'superadmin'), createPaymentStatusEntry)
router.put('/:id', protect, authorize('admin', 'superadmin'), updatePaymentStatusEntry)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deletePaymentStatusEntry)

export default router

