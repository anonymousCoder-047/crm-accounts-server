import { Router } from 'express'
import {
  createAccountHandler,
  getAccounts,
  getAccount,
  getAccountByAccountIdHandler,
  updateAccountHandler,
  deleteAccountHandler,
  updateOpeningBalanceHandler,
} from '../controllers/accountController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

// All routes require authentication and admin/manager/superadmin role
router.use(protect, authorize('admin', 'manager', 'superadmin'))

// GET /api/accounts - List all accounts
router.get('/', getAccounts)

// GET /api/accounts/by-account-id/:accountId - Get account by account_id
router.get('/by-account-id/:accountId', getAccountByAccountIdHandler)

// POST /api/accounts - Create new account
router.post('/', createAccountHandler)

// GET /api/accounts/:id - Get account by MongoDB _id
router.get('/:id', getAccount)

// PUT /api/accounts/:id - Update account
router.put('/:id', updateAccountHandler)

// PATCH /api/accounts/:id/opening-balance - Update opening balance
router.patch('/:id/opening-balance', updateOpeningBalanceHandler)

// DELETE /api/accounts/:id - Delete account
router.delete('/:id', deleteAccountHandler)

export default router

