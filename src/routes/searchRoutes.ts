import { Router } from 'express'
import { searchHandler } from '../controllers/searchController'
import { protect } from '../middleware/auth'

const router = Router()

// GET /api/search?q=query&limit=10
router.get('/', protect, searchHandler)

export default router


