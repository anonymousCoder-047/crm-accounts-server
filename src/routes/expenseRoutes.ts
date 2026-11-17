import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createExpenseEntry,
  deleteExpenseEntry,
  getExpense,
  getExpenses,
  updateExpenseEntry,
  updateExpenseStatus,
  getExpenseAttachment,
  generateZipDownloadLink,
  downloadZipFile,
} from '../controllers/expenseController'
import { uploadExpense } from '../middleware/upload'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getExpenses)
router.get('/download-zip/:token', downloadZipFile) // Must come before /:id to avoid route conflicts
router.get('/:id/attachment', protect, authorize('admin', 'manager', 'superadmin'), getExpenseAttachment)
router.post(
  '/:id/generate-zip-link',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  generateZipDownloadLink
)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getExpense)
router.post(
  '/',
  protect,
  authorize('admin', 'superadmin'),
  uploadExpense.array('attachments', 10), // Support up to 10 files
  createExpenseEntry
)
router.put(
  '/:id',
  protect,
  authorize('admin', 'superadmin'),
  uploadExpense.array('attachments', 10), // Support up to 10 files
  updateExpenseEntry
)
router.patch('/:id/status', protect, authorize('admin', 'manager', 'superadmin'), updateExpenseStatus)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteExpenseEntry)

export default router


