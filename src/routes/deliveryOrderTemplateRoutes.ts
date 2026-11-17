import express from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createDeliveryOrderTemplate,
  getTemplates,
  getTemplate,
  getDefaultDeliveryOrderTemplate,
  updateDeliveryOrderTemplate,
  deleteDeliveryOrderTemplate,
  setDefaultTemplate,
} from '../controllers/deliveryOrderTemplateController'
import multer from 'multer'

const router = express.Router()

// Configure multer for file uploads (logo)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
})

// Get all templates (admin, manager, superadmin can view)
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getTemplates)

// Get default template (admin, manager, superadmin can view)
router.get('/default', protect, authorize('admin', 'manager', 'superadmin'), getDefaultDeliveryOrderTemplate)

// Get single template (admin, manager, superadmin can view)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getTemplate)

// Create template (admin, superadmin only) - with file upload support
router.post('/', protect, authorize('admin', 'superadmin'), upload.single('logo'), createDeliveryOrderTemplate)

// Update template (admin, superadmin only) - with file upload support
router.put('/:id', protect, authorize('admin', 'superadmin'), upload.single('logo'), updateDeliveryOrderTemplate)

// Set default template (admin, superadmin only)
router.patch('/:id/set-default', protect, authorize('admin', 'superadmin'), setDefaultTemplate)

// Delete template (admin, superadmin only)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteDeliveryOrderTemplate)

export default router
