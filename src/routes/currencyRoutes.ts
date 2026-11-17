import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createCurrencyEntry,
  deleteCurrencyEntry,
  getCurrency,
  getCurrencies,
  updateCurrencyEntry,
} from '../controllers/currencyController'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getCurrencies)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getCurrency)
router.post('/', protect, authorize('admin', 'superadmin'), createCurrencyEntry)
router.put('/:id', protect, authorize('admin', 'superadmin'), updateCurrencyEntry)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteCurrencyEntry)

export default router


