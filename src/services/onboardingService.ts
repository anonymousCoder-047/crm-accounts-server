import Account, { IAccount, AccountType, AccountSubType } from '../models/Account'
import { getAccountSubType } from './accountSubTypeMapper'
import JournalEntry from '../models/JournalEntry'
import GeneralLedger from '../models/GeneralLedger'
import Onboarding, { IOnboarding } from '../models/Onboarding'
import Settings from '../models/Settings'
import PaymentMethod from '../models/PaymentMethod'
import mongoose from 'mongoose'
import { createLedgerEntries } from './journalEntryService'
import { upsertSettings } from './settingsService'

export interface BusinessProfile {
  business_name: string
  country: string
  currency: string
  fiscal_year_start: string
  tax_registration_number?: string
  logo_url?: string
}

export interface OpeningBalance {
  account_id: string
  account_name: string
  balance: number
  account_type: AccountType
}

export interface TaxConfig {
  vat_rate?: number
  gst_rate?: number
  tax_rates: Array<{ name: string; rate: number; account_id?: string }>
  tax_inclusive: boolean
  default_tax_account_id?: string
}

export interface InventoryConfig {
  enabled: boolean
  valuation_method: 'FIFO' | 'Weighted Average'
  opening_stock?: Array<{
    product_name: string
    sku: string
    quantity: number
    unit_cost: number
  }>
}

export interface PaymentMethod {
  name: string
  type: 'cash' | 'bank' | 'mobile' | 'card' | 'other'
  account_id?: string
  is_default: boolean
}

/**
 * Generate default Chart of Accounts based on country
 */
export async function generateDefaultChartOfAccounts(
  country: string,
  currency: string
): Promise<IAccount[]> {
  const defaultAccounts: Array<{
    account_name: string
    account_type: AccountType
    account_sub_type: AccountSubType
    account_code: string
    description?: string
    is_system_account: boolean
    opening_balance?: number
  }> = [
    // Assets - Current Assets
    { account_name: 'Cash', account_type: 'Asset', account_sub_type: 'Current Asset', account_code: '1000', is_system_account: true },
    { account_name: 'Bank Account', account_type: 'Asset', account_sub_type: 'Current Asset', account_code: '1010', is_system_account: true },
    { account_name: 'Accounts Receivable', account_type: 'Asset', account_sub_type: 'Current Asset', account_code: '1100', is_system_account: true },
    { account_name: 'Inventory', account_type: 'Asset', account_sub_type: 'Current Asset', account_code: '1200', is_system_account: true },
    // Assets - Non-Current Assets
    { account_name: 'Fixed Assets', account_type: 'Asset', account_sub_type: 'Non-Current Asset', account_code: '1500', is_system_account: false },
    // Assets - Contra Assets
    { account_name: 'Accumulated Depreciation', account_type: 'Asset', account_sub_type: 'Contra Asset', account_code: '1501', is_system_account: false },
    
    // Liabilities - Current Liabilities
    { account_name: 'Accounts Payable', account_type: 'Liability', account_sub_type: 'Current Liability', account_code: '2000', is_system_account: true },
    { account_name: 'Tax Payable', account_type: 'Liability', account_sub_type: 'Current Liability', account_code: '2100', is_system_account: true },
    // Liabilities - Non-Current Liabilities
    { account_name: 'Loans Payable', account_type: 'Liability', account_sub_type: 'Non-Current Liability', account_code: '2200', is_system_account: false },
    
    // Equity - Owner Capital
    { account_name: 'Owner Equity', account_type: 'Equity', account_sub_type: 'Owner Capital', account_code: '3000', is_system_account: false },
    // Equity - Retained Earnings
    { account_name: 'Retained Earnings', account_type: 'Equity', account_sub_type: 'Retained Earnings', account_code: '3100', is_system_account: true },
    { account_name: 'Current Year Earnings', account_type: 'Equity', account_sub_type: 'Retained Earnings', account_code: '3200', is_system_account: true },
    
    // Revenue - Operating Revenue
    { account_name: 'Sales Income', account_type: 'Revenue', account_sub_type: 'Operating Revenue', account_code: '4000', is_system_account: true },
    { account_name: 'Service Income', account_type: 'Revenue', account_sub_type: 'Operating Revenue', account_code: '4100', is_system_account: false },
    // Revenue - Non-Operating Revenue
    { account_name: 'Other Income', account_type: 'Revenue', account_sub_type: 'Non-Operating Revenue', account_code: '4900', is_system_account: false },
    
    // Expenses - COGS
    { account_name: 'Cost of Goods Sold', account_type: 'Expense', account_sub_type: 'COGS', account_code: '5000', is_system_account: true },
    // Expenses - Operating Expenses
    { account_name: 'Rent Expense', account_type: 'Expense', account_sub_type: 'Operating Expense', account_code: '6000', is_system_account: false },
    { account_name: 'Utilities Expense', account_type: 'Expense', account_sub_type: 'Operating Expense', account_code: '6100', is_system_account: false },
    { account_name: 'Salaries Expense', account_type: 'Expense', account_sub_type: 'Operating Expense', account_code: '6200', is_system_account: false },
    { account_name: 'Supplies Expense', account_type: 'Expense', account_sub_type: 'Operating Expense', account_code: '6300', is_system_account: false },
    { account_name: 'Marketing Expense', account_type: 'Expense', account_sub_type: 'Operating Expense', account_code: '6400', is_system_account: false },
    { account_name: 'Other Expenses', account_type: 'Expense', account_sub_type: 'Operating Expense', account_code: '6900', is_system_account: false },
  ]

  const accounts: IAccount[] = []
  
  for (const acc of defaultAccounts) {
    // Generate account_id manually to ensure it's set before validation
    const prefix = acc.account_type === 'Asset' ? 'ASSET' :
                   acc.account_type === 'Liability' ? 'LIAB' :
                   acc.account_type === 'Equity' ? 'EQUITY' :
                   acc.account_type === 'Revenue' ? 'REV' : 'EXP'
    const account_id = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    
    // Create account with all required fields including account_id
    const account = new Account({
      account_id,
      account_name: acc.account_name,
      account_type: acc.account_type,
      account_sub_type: acc.account_sub_type,
      account_code: acc.account_code,
      description: acc.description,
      is_system_account: acc.is_system_account,
      is_active: true,
      currency,
      opening_balance: acc.opening_balance || 0,
      current_balance: acc.opening_balance || 0,
    })
    await account.save()
    accounts.push(account)
  }

  return accounts
}

/**
 * Create opening balance journal entries
 */
export async function createOpeningBalanceEntries(
  openingBalances: OpeningBalance[],
  userId: mongoose.Types.ObjectId
): Promise<void> {
  if (openingBalances.length === 0) return

  // Calculate total debits and credits
  let totalDebits = 0
  let totalCredits = 0

  const entries: Array<{
    account_id: string
    account_name: string
    debit: number
    credit: number
  }> = []

  for (const balance of openingBalances) {
    const account = await Account.findOne({ 
      $or: [
        { account_id: balance.account_id },
        { account_name: balance.account_name }
      ]
    })
    if (!account) continue

    const accountId = account.account_id || String((account as any)._id || (account as IAccount)._id)

    if (balance.account_type === 'Asset' || balance.account_type === 'Expense') {
      // Assets and Expenses increase on debit
      entries.push({
        account_id: accountId,
        account_name: account.account_name,
        debit: balance.balance,
        credit: 0,
      })
      totalDebits += balance.balance
    } else {
      // Liabilities, Equity, Revenue increase on credit
      entries.push({
        account_id: accountId,
        account_name: account.account_name,
        debit: 0,
        credit: balance.balance,
      })
      totalCredits += balance.balance
    }
  }

  // Create balancing entry for Retained Earnings or Owner Equity
  const difference = totalDebits - totalCredits
  if (Math.abs(difference) > 0.01) {
    const equityAccount = await Account.findOne({
      account_name: 'Owner Equity',
      account_type: 'Equity',
    })
    
    if (equityAccount) {
      const equityAccountId = equityAccount.account_id || String((equityAccount as any)._id || (equityAccount as IAccount)._id)
      if (difference > 0) {
        entries.push({
          account_id: equityAccountId,
          account_name: equityAccount.account_name,
          debit: 0,
          credit: difference,
        })
        totalCredits += difference
      } else {
        entries.push({
          account_id: equityAccountId,
          account_name: equityAccount.account_name,
          debit: Math.abs(difference),
          credit: 0,
        })
        totalDebits += Math.abs(difference)
      }
    }
  }

  // Create journal entry
  const journalEntry = new JournalEntry({
    journal_id: `OB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    date: new Date(),
    reference: 'Opening Balance',
    description: 'Opening Balance Entry',
    entries,
    createdBy: userId,
    source_module: 'manual',
  })

  await journalEntry.save()

  // Create ledger entries
  await createLedgerEntries(journalEntry)
}

/**
 * Save business profile
 */
export async function saveBusinessProfile(
  profile: BusinessProfile,
  userId: mongoose.Types.ObjectId
): Promise<IOnboarding> {
  let onboarding = await Onboarding.findOne({ createdBy: userId })
  
  if (!onboarding) {
    onboarding = new Onboarding({
      business_name: profile.business_name,
      country: profile.country,
      currency: profile.currency,
      fiscal_year_start: new Date(profile.fiscal_year_start),
      tax_registration_number: profile.tax_registration_number,
      logo_url: profile.logo_url,
      createdBy: userId,
    })
  } else {
    onboarding.business_name = profile.business_name
    onboarding.country = profile.country
    onboarding.currency = profile.currency
    onboarding.fiscal_year_start = new Date(profile.fiscal_year_start)
    onboarding.tax_registration_number = profile.tax_registration_number
    onboarding.logo_url = profile.logo_url
  }

  await onboarding.save()

  // Also save to Settings model so it appears in Settings page
  await upsertSettings({
    businessInformation: {
      companyName: profile.business_name,
      logoUrl: profile.logo_url,
    },
    companyAddress: {
      country: profile.country,
    },
    taxInformation: {
      trn: profile.tax_registration_number,
    },
  })

  return onboarding
}

/**
 * Initialize Chart of Accounts
 */
export async function initializeChartOfAccounts(
  userId: mongoose.Types.ObjectId,
  customAccounts?: Array<{
    account_name: string
    account_type: AccountType
    account_code?: string
    description?: string
  }>
): Promise<IAccount[]> {
  const onboarding = await Onboarding.findOne({ createdBy: userId })
  if (!onboarding) {
    throw new Error('Business profile must be set up first')
  }

  // Check if already initialized
  if (onboarding.chart_of_accounts_initialized) {
    return await Account.find({})
  }

  // Generate default accounts
  const accounts = await generateDefaultChartOfAccounts(onboarding.country, onboarding.currency)

  // Add custom accounts if provided
  if (customAccounts && customAccounts.length > 0) {
    for (const customAcc of customAccounts) {
      // Generate account_id manually to ensure it's set before validation
      const prefix = customAcc.account_type === 'Asset' ? 'ASSET' :
                     customAcc.account_type === 'Liability' ? 'LIAB' :
                     customAcc.account_type === 'Equity' ? 'EQUITY' :
                     customAcc.account_type === 'Revenue' ? 'REV' : 'EXP'
      const account_id = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      
      // Determine sub-type based on account name and type
      const account_sub_type = getAccountSubType(customAcc.account_name, customAcc.account_type)
      
      // Create account with all required fields including account_id
      const account = new Account({
        account_id,
        account_name: customAcc.account_name,
        account_type: customAcc.account_type,
        account_sub_type,
        account_code: customAcc.account_code,
        description: customAcc.description,
        is_system_account: false,
        is_active: true,
        currency: onboarding.currency,
        opening_balance: 0,
        current_balance: 0,
      })
      await account.save()
      accounts.push(account)
    }
  }

  onboarding.chart_of_accounts_initialized = true
  await onboarding.save()

  // Return accounts as IAccount[] (not lean)
  return await Account.find({})
}

/**
 * Set opening balances
 */
export async function setOpeningBalances(
  openingBalances: OpeningBalance[],
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const onboarding = await Onboarding.findOne({ createdBy: userId })
  if (!onboarding) {
    throw new Error('Business profile must be set up first')
  }

  // If chart of accounts is not initialized, initialize it with defaults first
  if (!onboarding.chart_of_accounts_initialized) {
    await generateDefaultChartOfAccounts(onboarding.country, onboarding.currency)
    onboarding.chart_of_accounts_initialized = true
    await onboarding.save()
  }

  await createOpeningBalanceEntries(openingBalances, userId)

  onboarding.opening_balances_set = true
  await onboarding.save()
}

/**
 * Configure tax settings
 */
export async function configureTax(
  taxConfig: TaxConfig,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const onboarding = await Onboarding.findOne({ createdBy: userId })
  if (!onboarding) {
    throw new Error('Business profile must be set up first')
  }

  onboarding.tax_configured = true
  await onboarding.save()

  // Also save tax configuration to Settings model
  const settingsUpdate: any = {
    taxInformation: {},
  }

  // Get existing settings to merge
  const existingSettings = await Settings.findOne({})
  
  if (taxConfig.vat_rate) {
    settingsUpdate.taxInformation.vatNumber = `VAT Rate: ${taxConfig.vat_rate}%`
  } else if (taxConfig.gst_rate) {
    settingsUpdate.taxInformation.vatNumber = `GST Rate: ${taxConfig.gst_rate}%`
  } else if (taxConfig.tax_rates && taxConfig.tax_rates.length > 0) {
    const taxRatesStr = taxConfig.tax_rates.map(tr => `${tr.name}: ${tr.rate}%`).join(', ')
    settingsUpdate.taxInformation.vatNumber = taxRatesStr
  }
  
  // Preserve existing TRN if it exists
  if (existingSettings?.taxInformation?.trn) {
    settingsUpdate.taxInformation.trn = existingSettings.taxInformation.trn
  }

  await upsertSettings(settingsUpdate)
}

/**
 * Setup inventory
 */
export async function setupInventory(
  inventoryConfig: InventoryConfig,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const onboarding = await Onboarding.findOne({ createdBy: userId })
  if (!onboarding) {
    throw new Error('Business profile must be set up first')
  }

  // Store inventory configuration
  onboarding.inventory_setup = true
  await onboarding.save()

  // If opening stock is provided, create inventory entries
  if (inventoryConfig.opening_stock && inventoryConfig.opening_stock.length > 0) {
    const Inventory = (await import('../models/Inventory')).default
    const inventoryAccount = await Account.findOne({ account_name: 'Inventory' })
    
    if (!inventoryAccount) {
      throw new Error('Inventory account not found')
    }

    for (const stock of inventoryConfig.opening_stock) {
      const inventoryItem = new Inventory({
        sku: stock.sku,
        product_name: stock.product_name,
        quantity_on_hand: stock.quantity,
        unit_cost: stock.unit_cost,
        selling_price: stock.unit_cost * 1.5, // Default markup
        inventory_valuation_method: inventoryConfig.valuation_method,
        is_active: true,
      })
      await inventoryItem.save()

      // Create journal entry for opening inventory
      if (stock.quantity > 0 && stock.unit_cost > 0) {
        const totalCost = stock.quantity * stock.unit_cost
        
        const equityAccount = await Account.findOne({ account_name: 'Owner Equity', account_type: 'Equity' })
        if (!equityAccount) {
          throw new Error('Owner Equity account not found')
        }
        
        const journalEntry = new JournalEntry({
          journal_id: `INV-OB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          date: new Date(),
          reference: `Opening Stock - ${stock.product_name}`,
          description: `Opening Inventory: ${stock.product_name}`,
          entries: [
            {
              account_id: inventoryAccount.account_id || String((inventoryAccount as any)._id || (inventoryAccount as IAccount)._id),
              account_name: inventoryAccount.account_name,
              debit: totalCost,
              credit: 0,
            },
            {
              account_id: equityAccount.account_id || String((equityAccount as any)._id || (equityAccount as IAccount)._id),
              account_name: equityAccount.account_name,
              debit: 0,
              credit: totalCost,
            },
          ],
          createdBy: userId,
          source_module: 'inventory',
        })

        await journalEntry.save()
        await createLedgerEntries(journalEntry)
      }
    }
  }
}

/**
 * Setup payment methods
 */
export async function setupPaymentMethods(
  paymentMethods: PaymentMethod[],
  userId: mongoose.Types.ObjectId
): Promise<void> {
  const onboarding = await Onboarding.findOne({ createdBy: userId })
  if (!onboarding) {
    throw new Error('Business profile must be set up first')
  }

  onboarding.payment_methods_setup = true
  await onboarding.save()

  // Also save payment methods to PaymentMethod model
  for (const pm of paymentMethods) {
    // Check if payment method already exists
    const existing = await PaymentMethod.findOne({ name: pm.name })
    if (!existing) {
      await PaymentMethod.create({
        name: pm.name,
        description: `${pm.type} payment method`,
        isActive: true,
      })
    }
  }
}

/**
 * Get onboarding status
 */
export async function getOnboardingStatus(
  userId: mongoose.Types.ObjectId
): Promise<IOnboarding | null> {
  return await Onboarding.findOne({ createdBy: userId })
}

/**
 * Complete onboarding
 */
export async function completeOnboarding(
  userId: mongoose.Types.ObjectId
): Promise<IOnboarding> {
  const onboarding = await Onboarding.findOne({ createdBy: userId })
  if (!onboarding) {
    throw new Error('Onboarding not found')
  }

  onboarding.is_completed = true
  onboarding.completed_at = new Date()
  await onboarding.save()

  return onboarding
}

