import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createExpenseTypeEntry,
  deleteExpenseTypeEntry,
  getExpenseType,
  getExpenseTypes,
  updateExpenseTypeEntry,
} from '../controllers/expenseTypeController'

const router = Router()

// Test route to verify route registration (remove in production)
router.get('/ping', (req, res) => {
  res.json({ success: true, message: 'Expense types route is registered and working!' })
})

router.post('/', protect, authorize('admin', 'manager', 'superadmin'), createExpenseTypeEntry)
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getExpenseTypes)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getExpenseType)
router.put('/:id', protect, authorize('admin', 'manager', 'superadmin'), updateExpenseTypeEntry)
router.delete('/:id', protect, authorize('admin', 'manager', 'superadmin'), deleteExpenseTypeEntry)

export default router

