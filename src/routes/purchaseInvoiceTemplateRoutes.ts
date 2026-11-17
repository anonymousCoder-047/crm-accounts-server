import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createTemplate,
  deleteTemplate,
  getDefaultTemplate,
  getTemplate,
  getTemplates,
  setDefault,
  updateTemplate,
} from '../controllers/purchaseInvoiceTemplateController'
import multer from 'multer'

const router = Router()

// Configure multer for file uploads (logo)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
})

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getTemplates)
router.get('/default', protect, authorize('admin', 'manager', 'superadmin'), getDefaultTemplate)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getTemplate)
router.post('/', protect, authorize('admin', 'superadmin'), upload.single('logo'), createTemplate)
router.put('/:id', protect, authorize('admin', 'superadmin'), upload.single('logo'), updateTemplate)
router.patch('/:id/set-default', protect, authorize('admin', 'superadmin'), setDefault)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteTemplate)

export default router


