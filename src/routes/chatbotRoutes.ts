import { Router } from 'express'
import { sendMessage } from '../controllers/chatbotController'
import { protect } from '../middleware/auth'

const router = Router()

router.post('/message', protect, sendMessage)

export default router

