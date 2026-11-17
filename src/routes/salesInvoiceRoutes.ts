import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  getInvoices,
  updateInvoice,
  updatePaymentStatusHandler,
  applyPayment,
  generateShareLink,
  getInvoiceByShareToken,
  getInvoiceQrCode,
} from '../controllers/salesInvoiceController'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getInvoices)
router.get('/share/:token', getInvoiceByShareToken)
router.get('/:id/qr-code', protect, authorize('admin', 'manager', 'superadmin'), getInvoiceQrCode)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getInvoice)
router.post('/', protect, authorize('admin', 'superadmin'), createInvoice)
router.put('/:id', protect, authorize('admin', 'superadmin'), updateInvoice)
router.patch('/:id/payment-status', protect, authorize('admin', 'manager', 'superadmin'), updatePaymentStatusHandler)
router.post('/:id/apply-payment', protect, authorize('admin', 'manager', 'superadmin'), applyPayment)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteInvoice)
router.post('/:id/share', protect, authorize('admin', 'manager', 'superadmin'), generateShareLink)

export default router


