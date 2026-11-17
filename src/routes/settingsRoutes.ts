import { Router } from 'express'
import { getAppSettings, updateAppSettings } from '../controllers/settingsController'
import { protect, authorize } from '../middleware/auth'

const router = Router()

router.get('/', protect, authorize('admin', 'manager', 'superadmin'), getAppSettings)
router.put('/', protect, authorize('admin', 'superadmin'), updateAppSettings)

export default router


