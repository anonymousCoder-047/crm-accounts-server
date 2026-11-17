import { Router } from 'express'
import {
  saveBusinessProfileHandler,
  initializeChartOfAccountsHandler,
  setOpeningBalancesHandler,
  configureTaxHandler,
  setupInventoryHandler,
  setupPaymentMethodsHandler,
  getOnboardingStatusHandler,
  completeOnboardingHandler,
} from '../controllers/onboardingController'
import { protect } from '../middleware/auth'

const router = Router()

// All onboarding routes require authentication
router.use(protect)

// GET /api/onboarding/status - Get onboarding status
router.get('/status', getOnboardingStatusHandler)

// POST /api/onboarding/business-profile - Save business profile
router.post('/business-profile', saveBusinessProfileHandler)

// POST /api/onboarding/chart-of-accounts - Initialize Chart of Accounts
router.post('/chart-of-accounts', initializeChartOfAccountsHandler)

// POST /api/onboarding/opening-balances - Set opening balances
router.post('/opening-balances', setOpeningBalancesHandler)

// POST /api/onboarding/tax - Configure tax settings
router.post('/tax', configureTaxHandler)

// POST /api/onboarding/inventory - Setup inventory
router.post('/inventory', setupInventoryHandler)

// POST /api/onboarding/payment-methods - Setup payment methods
router.post('/payment-methods', setupPaymentMethodsHandler)

// POST /api/onboarding/complete - Complete onboarding
router.post('/complete', completeOnboardingHandler)

export default router

