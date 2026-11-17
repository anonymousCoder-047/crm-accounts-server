import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createPaymentMethodEntry,
  deletePaymentMethodEntry,
  getPaymentMethod,
  getPaymentMethods,
  updatePaymentMethodEntry,
} from '../controllers/paymentMethodController'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getPaymentMethods)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getPaymentMethod)
router.post('/', protect, authorize('admin', 'superadmin'), createPaymentMethodEntry)
router.put('/:id', protect, authorize('admin', 'superadmin'), updatePaymentMethodEntry)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deletePaymentMethodEntry)

export default router


