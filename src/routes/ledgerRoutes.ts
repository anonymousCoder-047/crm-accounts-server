import { Router } from 'express'
import {
  getLedgerEntries,
  getAccountLedgerHandler,
  getTrialBalance,
  getDateRangeSummaryHandler,
  getAccounts,
  getLedgerEntry,
  updateLedgerEntryHandler,
  deleteLedgerEntryHandler,
  bulkDeleteLedgerEntriesHandler,
} from '../controllers/ledgerController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

// GET /api/general-ledger - List ledger entries with filters
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getLedgerEntries)

// GET /api/general-ledger/accounts - Get all unique accounts
router.get('/accounts', protect, authorize('admin', 'manager', 'superadmin'), getAccounts)

// GET /api/general-ledger/trial-balance - Generate trial balance
router.get('/trial-balance', protect, authorize('admin', 'manager', 'superadmin'), getTrialBalance)

// GET /api/general-ledger/summary - Get date range summary
router.get('/summary', protect, authorize('admin', 'manager', 'superadmin'), getDateRangeSummaryHandler)

// POST /api/general-ledger/bulk-delete - Bulk delete ledger entries
router.post('/bulk-delete', protect, authorize('admin', 'superadmin'), bulkDeleteLedgerEntriesHandler)

// GET /api/general-ledger/account/:accountId - Get account-wise ledger
router.get('/account/:accountId', protect, authorize('admin', 'manager', 'superadmin'), getAccountLedgerHandler)

// GET /api/general-ledger/:id - Get ledger entry by ID
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getLedgerEntry)

// PUT /api/general-ledger/:id - Update ledger entry
router.put('/:id', protect, authorize('admin', 'superadmin'), updateLedgerEntryHandler)

// DELETE /api/general-ledger/:id - Delete ledger entry
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteLedgerEntryHandler)

export default router

