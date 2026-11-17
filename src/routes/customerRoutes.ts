import { Router } from 'express'
import { protect, authorize } from '../middleware/auth'
import {
  createCustomerEntry,
  deleteCustomerEntry,
  getCustomer,
  getCustomers,
  updateCustomerEntry,
} from '../controllers/customerController'

const router = Router()

router.post('/', protect, authorize('admin', 'manager', 'superadmin'), createCustomerEntry)
router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getCustomers)
router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getCustomer)
router.put('/:id', protect, authorize('admin', 'manager', 'superadmin'), updateCustomerEntry)
router.delete('/:id', protect, authorize('admin', 'manager', 'superadmin'), deleteCustomerEntry)

export default router

