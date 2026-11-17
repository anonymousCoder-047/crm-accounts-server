import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createItem,
  deleteItem,
  getItem,
  getItems,
  updateItem,
  adjustStock,
  getTransactions,
  getLowStock,
  generateJournalEntry,
  getPriceHistory,
} from '../controllers/inventoryController'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getItems)
router.get('/low-stock', protect, authorize('admin', 'manager', 'superadmin'), getLowStock)
router.get('/transactions', protect, authorize('admin', 'manager', 'superadmin'), getTransactions)
router.get('/:id/price-history', protect, authorize('admin', 'manager', 'superadmin'), getPriceHistory)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getItem)
router.post('/', protect, authorize('admin', 'superadmin'), createItem)
router.post('/adjust-stock', protect, authorize('admin', 'superadmin'), adjustStock)
router.post('/generate-journal-entry', protect, authorize('admin', 'superadmin'), generateJournalEntry)
router.put('/:id', protect, authorize('admin', 'superadmin'), updateItem)
router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteItem)

export default router


