import { Router } from 'express'
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
  getStatementOfEquity,
  getTrialBalance,
} from '../controllers/financialStatementsController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

// GET /api/statements/income - Generate Income Statement
router.get('/income', protect, authorize('admin', 'manager', 'superadmin'), getIncomeStatement)

// GET /api/statements/balance-sheet - Generate Balance Sheet
router.get('/balance-sheet', protect, authorize('admin', 'manager', 'superadmin'), getBalanceSheet)

// GET /api/statements/cashflow - Generate Cash Flow Statement
router.get('/cashflow', protect, authorize('admin', 'manager', 'superadmin'), getCashFlowStatement)

// GET /api/statements/equity - Generate Statement of Equity
router.get('/equity', protect, authorize('admin', 'manager', 'superadmin'), getStatementOfEquity)

// GET /api/statements/trial-balance - Generate Trial Balance
router.get('/trial-balance', protect, authorize('admin', 'manager', 'superadmin'), getTrialBalance)

export default router

