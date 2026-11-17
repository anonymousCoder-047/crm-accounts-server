import { Router } from 'express'
import {
  getJournalEntries,
  createJournalEntryHandler,
  updateJournalEntryHandler,
  getJournalEntry,
  getJournalEntriesByRef,
  deleteJournalEntryHandler,
  regenerateLedgerHandler,
  bulkDeleteJournalEntriesHandler,
  removeDuplicateJournalEntriesHandler,
} from '../controllers/journalEntryController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

// GET /api/ledger - List journal entries with filters
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getJournalEntries)

// POST /api/ledger - Create manual journal entry
router.post('/', protect, authorize('admin', 'superadmin'), createJournalEntryHandler)

// POST /api/ledger/regenerate - Regenerate ledger from all journal entries
router.post('/regenerate', protect, authorize('superadmin'), regenerateLedgerHandler)

// POST /api/ledger/bulk-delete - Bulk delete journal entries
router.post('/bulk-delete', protect, authorize('admin', 'superadmin'), bulkDeleteJournalEntriesHandler)

// POST /api/ledger/remove-duplicates - Find and remove duplicate journal entries
router.post('/remove-duplicates', protect, authorize('superadmin'), removeDuplicateJournalEntriesHandler)

// GET /api/ledger/:id - Get journal entry by ID
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getJournalEntry)

// PUT /api/ledger/:id - Update journal entry
router.put('/:id', protect, authorize('admin', 'superadmin'), updateJournalEntryHandler)

// GET /api/ledger/reference/:referenceType/:referenceId - Get entries by reference
router.get('/reference/:referenceType/:referenceId', protect, authorize('admin', 'manager', 'superadmin'), getJournalEntriesByRef)

// DELETE /api/ledger/:id - Delete journal entry
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteJournalEntryHandler)

export default router

