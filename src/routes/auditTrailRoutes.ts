import { Router } from 'express'
import {
  createAuditTrailEntry,
  deleteAuditTrailEntry,
  getAuditTrail,
  getAuditTrails,
  cleanupOldAuditTrails,
  getAuditTrailStatistics,
} from '../controllers/auditTrailController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

router.post('/', protect, authorize('admin', 'superadmin'), createAuditTrailEntry)

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getAuditTrails)

router.get('/stats', protect, authorize('admin', 'superadmin'), getAuditTrailStatistics)

router.get('/:id', protect, authorize('admin', 'manager', 'superadmin'), getAuditTrail)

router.delete('/:id', protect, authorize('admin', 'superadmin'), deleteAuditTrailEntry)

router.post('/cleanup', protect, authorize('superadmin'), cleanupOldAuditTrails)

export default router

