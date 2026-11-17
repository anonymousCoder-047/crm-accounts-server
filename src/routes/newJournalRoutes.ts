import { Router } from 'express'
import {
  createJournalHandler,
  getJournalHandler,
  listJournalsHandler,
  reverseJournalHandler,
} from '../controllers/journalController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

// Manual journal creation
router.post('/', protect, authorize('admin', 'superadmin'), createJournalHandler)

// List journals
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), listJournalsHandler)

// Get by journal_id
router.get('/:journalId', protect, authorize('admin', 'manager', 'superadmin'), getJournalHandler)

// Reverse by journal_id
router.post(
  '/:journalId/reverse',
  protect,
  authorize('admin', 'superadmin'),
  reverseJournalHandler
)

export default router



