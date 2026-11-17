import { Request, Response } from 'express'
import mongoose from 'mongoose'
import {
  saveBusinessProfile,
  initializeChartOfAccounts,
  setOpeningBalances,
  configureTax,
  setupInventory,
  setupPaymentMethods,
  getOnboardingStatus,
  completeOnboarding,
  BusinessProfile,
  OpeningBalance,
  TaxConfig,
  InventoryConfig,
  PaymentMethod,
} from '../services/onboardingService'
import { AuthRequest } from '../middleware/auth'

export const saveBusinessProfileHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const profile: BusinessProfile = req.body
    const onboarding = await saveBusinessProfile(profile, new mongoose.Types.ObjectId(userId))

    res.json({ success: true, data: onboarding })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const initializeChartOfAccountsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const { customAccounts } = req.body
    const accounts = await initializeChartOfAccounts(new mongoose.Types.ObjectId(userId), customAccounts)

    res.json({ success: true, data: accounts })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const setOpeningBalancesHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const openingBalances: OpeningBalance[] = req.body.opening_balances || []
    await setOpeningBalances(openingBalances, new mongoose.Types.ObjectId(userId))

    res.json({ success: true, message: 'Opening balances set successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const configureTaxHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const taxConfig: TaxConfig = req.body
    await configureTax(taxConfig, new mongoose.Types.ObjectId(userId))

    res.json({ success: true, message: 'Tax configuration saved successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const setupInventoryHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const inventoryConfig: InventoryConfig = req.body
    await setupInventory(inventoryConfig, new mongoose.Types.ObjectId(userId))

    res.json({ success: true, message: 'Inventory setup completed successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const setupPaymentMethodsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const paymentMethods: PaymentMethod[] = req.body.payment_methods || []
    await setupPaymentMethods(paymentMethods, new mongoose.Types.ObjectId(userId))

    res.json({ success: true, message: 'Payment methods setup completed successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getOnboardingStatusHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const status = await getOnboardingStatus(new mongoose.Types.ObjectId(userId))

    res.json({ success: true, data: status })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const completeOnboardingHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const onboarding = await completeOnboarding(new mongoose.Types.ObjectId(userId))

    res.json({ success: true, data: onboarding, message: 'Onboarding completed successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

