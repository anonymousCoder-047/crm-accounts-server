import { Router } from 'express'
import { postAccountingEvent } from '../controllers/accountingController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

// Central posting endpoint: POST /api/accounting/post
router.post(
  '/post',
  protect,
  authorize('admin', 'manager', 'superadmin'),
  postAccountingEvent
)

export default router



