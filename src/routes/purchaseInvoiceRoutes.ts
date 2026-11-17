import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createPurchase,
  deletePurchase,
  getPurchase,
  getPurchases,
  updatePurchase,
  updatePaymentStatusHandler,
  applyPayment,
  generateShareLink,
  getInvoiceByShareToken,
  getPurchaseInvoiceQrCode,
} from '../controllers/purchaseInvoiceController'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getPurchases)
router.get('/share/:token', getInvoiceByShareToken)
router.get('/:id/qr-code', protect, authorize('admin', 'manager', 'superadmin'), getPurchaseInvoiceQrCode)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getPurchase)
router.post('/', protect, authorize('admin', 'superadmin'), createPurchase)
router.put('/:id', protect, authorize('admin', 'superadmin'), updatePurchase)
router.patch('/:id/payment-status', protect, authorize('admin', 'manager', 'superadmin'), updatePaymentStatusHandler)
router.post('/:id/apply-payment', protect, authorize('admin', 'manager', 'superadmin'), applyPayment)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deletePurchase)
router.post('/:id/share', protect, authorize('admin', 'manager', 'superadmin'), generateShareLink)

export default router


