import { Router } from 'express'
import {
  createDeliveryOrderEntry,
  deleteDeliveryOrderEntry,
  getDeliveryOrder,
  getDeliveryOrders,
  updateDeliveryOrderEntry,
  getDeliveryOrderAttachment,
  generateZipDownloadLink,
  downloadZipFile,
} from '../controllers/deliveryOrderController'
import { protect, authorize } from '../middleware/auth'
import { uploadDeliveryOrder } from '../middleware/upload'

const router = Router()

router.post(
  '/',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  uploadDeliveryOrder.array('attachments', 10), // Support up to 10 files
  createDeliveryOrderEntry
)

router.get('/', protect, authorize('admin', 'manager', 'superadmin', 'user'), getDeliveryOrders)

router.get('/:id', protect, authorize('admin', 'manager', 'superadmin', 'user'), getDeliveryOrder)

router.put(
  '/:id',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  uploadDeliveryOrder.array('attachments', 10), // Support up to 10 files
  updateDeliveryOrderEntry
)

router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteDeliveryOrderEntry)

// Attachment download endpoint
router.get('/:id/attachment', protect, authorize('admin', 'manager', 'superadmin', 'user'), getDeliveryOrderAttachment)

// Generate zip download link endpoint
router.post('/:id/generate-zip-link', protect, authorize('admin', 'manager', 'superadmin', 'user'), generateZipDownloadLink)

// Download zip file using expiry token (no auth required - token provides security)
router.get('/download-zip/:token', downloadZipFile)

export default router

