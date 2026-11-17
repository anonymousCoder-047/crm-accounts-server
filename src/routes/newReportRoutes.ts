import { Router } from 'express'
import { getAccountLedgerHandler, getTrialBalance } from '../controllers/ledgerController'
import { getBalanceSheet, getIncomeStatement } from '../controllers/financialStatementsController'
import { listJournalsHandler } from '../controllers/journalController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

// Derived ledger for a single account
router.get(
  '/ledger/:accountId',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getAccountLedgerHandler
)

// Trial balance
router.get(
  '/trial-balance',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getTrialBalance
)

// Balance sheet
router.get(
  '/balance-sheet',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getBalanceSheet
)

// Profit & Loss
router.get(
  '/profit-and-loss',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  getIncomeStatement
)

// Raw journal listing
router.get(
  '/journals',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  listJournalsHandler
)

export default router



