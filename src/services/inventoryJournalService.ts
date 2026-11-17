import Account, { IAccount, AccountType } from '../models/Account'
import { createJournalEntry } from './journalEntryService'
import { IJournalEntryLine } from '../models/JournalEntry'
import Inventory, { IInventory } from '../models/Inventory'
import { IInventoryTransaction } from '../models/InventoryTransaction'

/**
 * Interface for inventory journal entry input
 */
export interface InventoryJournalEntryInput {
  product_id: string
  transaction_type: 'purchase' | 'sale' | 'adjustment_in' | 'adjustment_out' | 'return_in' | 'return_out'
  quantity: number
  unit_cost: number
  total_cost: number
  reference_id?: string // Purchase invoice, sales invoice, adjustment log, etc.
  reference?: string // Reference number/description
  date: Date
  createdBy: string
  // Optional account overrides (if not provided, will look up from Account model)
  inventory_account_id?: string
  inventory_account_name?: string
  cogs_account_id?: string
  cogs_account_name?: string
  adjustment_account_id?: string
  adjustment_account_name?: string
  accounts_payable_account_id?: string
  accounts_payable_account_name?: string
  accounts_receivable_account_id?: string
  accounts_receivable_account_name?: string
  cash_account_id?: string
  cash_account_name?: string
  sales_revenue_account_id?: string
  sales_revenue_account_name?: string
  notes?: string
}

/**
 * Interface for account lookup result
 */
interface AccountLookup {
  account_id: string
  account_name: string
  account_type: AccountType
}

/**
 * Default account names mapping
 */
const DEFAULT_ACCOUNT_NAMES = {
  INVENTORY: 'Inventory',
  COGS: 'Cost of Goods Sold',
  INVENTORY_ADJUSTMENT_GAIN: 'Inventory Adjustment Gain',
  INVENTORY_ADJUSTMENT_LOSS: 'Inventory Adjustment Loss',
  ACCOUNTS_PAYABLE: 'Accounts Payable',
  ACCOUNTS_RECEIVABLE: 'Accounts Receivable',
  CASH: 'Cash',
  SALES_REVENUE: 'Sales Revenue',
}

/**
 * Get account by name and type, with fallback logic
 */
async function getAccountByName(
  accountName: string,
  accountType?: AccountType
): Promise<AccountLookup | null> {
  try {
    // First try exact match
    let account = await Account.findOne({
      account_name: { $regex: new RegExp(`^${accountName}$`, 'i') },
      is_active: true,
    })

    // If not found and account type is provided, try by type
    if (!account && accountType) {
      account = await Account.findOne({
        account_type: accountType,
        is_active: true,
      }).sort({ createdAt: 1 }) // Get the first account of this type
    }

    // If still not found, try partial match
    if (!account) {
      account = await Account.findOne({
        account_name: { $regex: new RegExp(accountName, 'i') },
        is_active: true,
      })
    }

    if (account) {
      return {
        account_id: account.account_id,
        account_name: account.account_name,
        account_type: account.account_type,
      }
    }

    return null
  } catch (error) {
    console.error(`Error looking up account: ${accountName}`, error)
    return null
  }
}

/**
 * Get or create account lookup with fallback to default account_id
 */
async function getAccountWithFallback(
  accountName: string,
  accountType: AccountType,
  defaultAccountId: string
): Promise<AccountLookup> {
  const account = await getAccountByName(accountName, accountType)
  
  if (account) {
    return account
  }

  // Fallback to default account_id if account not found in database
  return {
    account_id: defaultAccountId,
    account_name: accountName,
    account_type: accountType,
  }
}

/**
 * Get inventory account
 */
async function getInventoryAccount(
  overrideAccountId?: string,
  overrideAccountName?: string
): Promise<AccountLookup> {
  if (overrideAccountId && overrideAccountName) {
    return {
      account_id: overrideAccountId,
      account_name: overrideAccountName,
      account_type: 'Asset',
    }
  }

  return getAccountWithFallback(
    DEFAULT_ACCOUNT_NAMES.INVENTORY,
    'Asset',
    'INVENTORY'
  )
}

/**
 * Get COGS account
 */
async function getCOGSAccount(
  overrideAccountId?: string,
  overrideAccountName?: string
): Promise<AccountLookup> {
  if (overrideAccountId && overrideAccountName) {
    return {
      account_id: overrideAccountId,
      account_name: overrideAccountName,
      account_type: 'Expense',
    }
  }

  return getAccountWithFallback(
    DEFAULT_ACCOUNT_NAMES.COGS,
    'Expense',
    'COST_OF_GOODS_SOLD'
  )
}

/**
 * Get inventory adjustment gain account
 */
async function getInventoryAdjustmentGainAccount(
  overrideAccountId?: string,
  overrideAccountName?: string
): Promise<AccountLookup> {
  if (overrideAccountId && overrideAccountName) {
    return {
      account_id: overrideAccountId,
      account_name: overrideAccountName,
      account_type: 'Revenue',
    }
  }

  return getAccountWithFallback(
    DEFAULT_ACCOUNT_NAMES.INVENTORY_ADJUSTMENT_GAIN,
    'Revenue',
    'INVENTORY_ADJUSTMENT_GAIN'
  )
}

/**
 * Get inventory adjustment loss account
 */
async function getInventoryAdjustmentLossAccount(
  overrideAccountId?: string,
  overrideAccountName?: string
): Promise<AccountLookup> {
  if (overrideAccountId && overrideAccountName) {
    return {
      account_id: overrideAccountId,
      account_name: overrideAccountName,
      account_type: 'Expense',
    }
  }

  return getAccountWithFallback(
    DEFAULT_ACCOUNT_NAMES.INVENTORY_ADJUSTMENT_LOSS,
    'Expense',
    'INVENTORY_ADJUSTMENT_LOSS'
  )
}

/**
 * Get accounts payable account
 */
async function getAccountsPayableAccount(
  overrideAccountId?: string,
  overrideAccountName?: string
): Promise<AccountLookup> {
  if (overrideAccountId && overrideAccountName) {
    return {
      account_id: overrideAccountId,
      account_name: overrideAccountName,
      account_type: 'Liability',
    }
  }

  return getAccountWithFallback(
    DEFAULT_ACCOUNT_NAMES.ACCOUNTS_PAYABLE,
    'Liability',
    'ACCOUNTS_PAYABLE'
  )
}

/**
 * Get accounts receivable account
 */
async function getAccountsReceivableAccount(
  overrideAccountId?: string,
  overrideAccountName?: string
): Promise<AccountLookup> {
  if (overrideAccountId && overrideAccountName) {
    return {
      account_id: overrideAccountId,
      account_name: overrideAccountName,
      account_type: 'Asset',
    }
  }

  return getAccountWithFallback(
    DEFAULT_ACCOUNT_NAMES.ACCOUNTS_RECEIVABLE,
    'Asset',
    'ACCOUNTS_RECEIVABLE'
  )
}

/**
 * Get cash account
 */
async function getCashAccount(
  overrideAccountId?: string,
  overrideAccountName?: string
): Promise<AccountLookup> {
  if (overrideAccountId && overrideAccountName) {
    return {
      account_id: overrideAccountId,
      account_name: overrideAccountName,
      account_type: 'Asset',
    }
  }

  // Try to find cash account
  const cashAccount = await getAccountByName('Cash', 'Asset')
  if (cashAccount) {
    return cashAccount
  }

  // Fallback
  return {
    account_id: 'CASH',
    account_name: 'Cash',
    account_type: 'Asset',
  }
}

/**
 * Get sales revenue account
 */
async function getSalesRevenueAccount(
  overrideAccountId?: string,
  overrideAccountName?: string
): Promise<AccountLookup> {
  if (overrideAccountId && overrideAccountName) {
    return {
      account_id: overrideAccountId,
      account_name: overrideAccountName,
      account_type: 'Revenue',
    }
  }

  return getAccountWithFallback(
    DEFAULT_ACCOUNT_NAMES.SALES_REVENUE,
    'Revenue',
    'SALES_REVENUE'
  )
}

/**
 * Generate journal entry for inventory purchase
 * Debit: Inventory
 * Credit: Accounts Payable or Cash
 */
async function generatePurchaseJournalEntry(
  input: InventoryJournalEntryInput,
  inventoryAccount: AccountLookup
): Promise<IJournalEntryLine[]> {
  const entries: IJournalEntryLine[] = []

  // Debit Inventory
  entries.push({
    account_id: inventoryAccount.account_id,
    account_name: inventoryAccount.account_name,
    debit: input.total_cost,
    credit: 0,
  })

  // Credit Accounts Payable (default) or Cash
  // Note: The actual payment method should be determined from the purchase invoice
  // For now, we'll default to Accounts Payable
  const payableAccount = await getAccountsPayableAccount(
    input.accounts_payable_account_id,
    input.accounts_payable_account_name
  )

  entries.push({
    account_id: payableAccount.account_id,
    account_name: payableAccount.account_name,
    debit: 0,
    credit: input.total_cost,
  })

  return entries
}

/**
 * Generate journal entry for inventory sale (COGS)
 * Debit: COGS
 * Credit: Inventory
 * Note: Revenue entry (Debit Cash/AR, Credit Sales Revenue) is handled by sales invoice
 */
async function generateSaleJournalEntry(
  input: InventoryJournalEntryInput,
  inventoryAccount: AccountLookup
): Promise<IJournalEntryLine[]> {
  const entries: IJournalEntryLine[] = []

  // Debit COGS
  const cogsAccount = await getCOGSAccount(
    input.cogs_account_id,
    input.cogs_account_name
  )

  entries.push({
    account_id: cogsAccount.account_id,
    account_name: cogsAccount.account_name,
    debit: input.total_cost,
    credit: 0,
  })

  // Credit Inventory
  entries.push({
    account_id: inventoryAccount.account_id,
    account_name: inventoryAccount.account_name,
    debit: 0,
    credit: input.total_cost,
  })

  return entries
}

/**
 * Generate journal entry for inventory adjustment IN (found stock)
 * Debit: Inventory
 * Credit: Inventory Adjustment Gain
 */
async function generateAdjustmentInJournalEntry(
  input: InventoryJournalEntryInput,
  inventoryAccount: AccountLookup
): Promise<IJournalEntryLine[]> {
  const entries: IJournalEntryLine[] = []

  // Debit Inventory
  entries.push({
    account_id: inventoryAccount.account_id,
    account_name: inventoryAccount.account_name,
    debit: input.total_cost,
    credit: 0,
  })

  // Credit Inventory Adjustment Gain
  const adjustmentGainAccount = await getInventoryAdjustmentGainAccount(
    input.adjustment_account_id,
    input.adjustment_account_name
  )

  entries.push({
    account_id: adjustmentGainAccount.account_id,
    account_name: adjustmentGainAccount.account_name,
    debit: 0,
    credit: input.total_cost,
  })

  return entries
}

/**
 * Generate journal entry for inventory adjustment OUT (lost/damaged)
 * Debit: Inventory Adjustment Loss
 * Credit: Inventory
 */
async function generateAdjustmentOutJournalEntry(
  input: InventoryJournalEntryInput,
  inventoryAccount: AccountLookup
): Promise<IJournalEntryLine[]> {
  const entries: IJournalEntryLine[] = []

  // Debit Inventory Adjustment Loss
  const adjustmentLossAccount = await getInventoryAdjustmentLossAccount(
    input.adjustment_account_id,
    input.adjustment_account_name
  )

  entries.push({
    account_id: adjustmentLossAccount.account_id,
    account_name: adjustmentLossAccount.account_name,
    debit: input.total_cost,
    credit: 0,
  })

  // Credit Inventory
  entries.push({
    account_id: inventoryAccount.account_id,
    account_name: inventoryAccount.account_name,
    debit: 0,
    credit: input.total_cost,
  })

  return entries
}

/**
 * Generate journal entry for purchase return (sending goods back to vendor)
 * Debit: Accounts Payable / Cash
 * Credit: Inventory
 */
async function generatePurchaseReturnJournalEntry(
  input: InventoryJournalEntryInput,
  inventoryAccount: AccountLookup
): Promise<IJournalEntryLine[]> {
  const entries: IJournalEntryLine[] = []

  // Debit Accounts Payable (vendor owes us less)
  const payableAccount = await getAccountsPayableAccount(
    input.accounts_payable_account_id,
    input.accounts_payable_account_name
  )

  entries.push({
    account_id: payableAccount.account_id,
    account_name: payableAccount.account_name,
    debit: input.total_cost,
    credit: 0,
  })

  // Credit Inventory
  entries.push({
    account_id: inventoryAccount.account_id,
    account_name: inventoryAccount.account_name,
    debit: 0,
    credit: input.total_cost,
  })

  return entries
}

/**
 * Generate journal entry for sales return (customer returns goods)
 * Debit: Inventory
 * Credit: COGS
 * Note: Revenue reversal (Debit Sales Revenue, Credit Cash/AR) is handled by sales invoice
 */
async function generateSalesReturnJournalEntry(
  input: InventoryJournalEntryInput,
  inventoryAccount: AccountLookup
): Promise<IJournalEntryLine[]> {
  const entries: IJournalEntryLine[] = []

  // Debit Inventory
  entries.push({
    account_id: inventoryAccount.account_id,
    account_name: inventoryAccount.account_name,
    debit: input.total_cost,
    credit: 0,
  })

  // Credit COGS (reverse the COGS entry from original sale)
  const cogsAccount = await getCOGSAccount(
    input.cogs_account_id,
    input.cogs_account_name
  )

  entries.push({
    account_id: cogsAccount.account_id,
    account_name: cogsAccount.account_name,
    debit: 0,
    credit: input.total_cost,
  })

  return entries
}

/**
 * Main function to generate inventory journal entry
 * This function automatically creates journal entries following double-entry accounting rules
 */
export async function generateInventoryJournalEntry(
  input: InventoryJournalEntryInput
): Promise<{
  success: boolean
  journalEntry?: any
  message: string
  entries: IJournalEntryLine[]
}> {
  try {
    // Validate input
    if (!input.product_id || !input.transaction_type || !input.quantity || !input.unit_cost) {
      throw new Error('Missing required fields: product_id, transaction_type, quantity, unit_cost')
    }

    if (input.total_cost <= 0) {
      throw new Error('Total cost must be greater than 0')
    }

    // Get inventory product
    const inventory = await Inventory.findById(input.product_id)
    if (!inventory) {
      throw new Error(`Inventory product not found: ${input.product_id}`)
    }

    // Get inventory account
    const inventoryAccount = await getInventoryAccount(
      input.inventory_account_id,
      input.inventory_account_name
    )

    // Generate journal entries based on transaction type
    let entries: IJournalEntryLine[] = []

    switch (input.transaction_type) {
      case 'purchase':
        entries = await generatePurchaseJournalEntry(input, inventoryAccount)
        break

      case 'sale':
        entries = await generateSaleJournalEntry(input, inventoryAccount)
        break

      case 'adjustment_in':
        entries = await generateAdjustmentInJournalEntry(input, inventoryAccount)
        break

      case 'adjustment_out':
        entries = await generateAdjustmentOutJournalEntry(input, inventoryAccount)
        break

      case 'return_in':
        entries = await generatePurchaseReturnJournalEntry(input, inventoryAccount)
        break

      case 'return_out':
        entries = await generateSalesReturnJournalEntry(input, inventoryAccount)
        break

      default:
        throw new Error(`Unsupported transaction type: ${input.transaction_type}`)
    }

    // Validate double-entry accounting (debits must equal credits)
    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0)
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Double-entry accounting violation: Total debit (${totalDebit}) must equal total credit (${totalCredit})`
      )
    }

    // Create description
    const productName = inventory.product_name || inventory.name || 'Unknown Product'
    const description = `${productName} - ${input.transaction_type.replace('_', ' ').toUpperCase()}: ${input.quantity} units @ ${input.unit_cost}`
    const fullDescription = input.notes
      ? `${description} (${input.notes})`
      : description

    // Create journal entry
    const journalEntry = await createJournalEntry({
      date: input.date,
      reference: input.reference || `${input.transaction_type.toUpperCase()}-${input.product_id}`,
      description: fullDescription,
      entries: entries,
      createdBy: input.createdBy,
      source_module: 'inventory',
      referenceId: input.reference_id,
    })

    return {
      success: true,
      journalEntry,
      message: `Journal entry created successfully for ${input.transaction_type}`,
      entries,
    }
  } catch (error: any) {
    console.error('Error generating inventory journal entry:', error)
    return {
      success: false,
      message: error.message || 'Failed to generate inventory journal entry',
      entries: [],
    }
  }
}

/**
 * Generate journal entry for inventory transfer between locations (optional)
 * Debit: Inventory - Location B
 * Credit: Inventory - Location A
 */
export async function generateInventoryTransferJournalEntry(
  fromLocationAccount: AccountLookup,
  toLocationAccount: AccountLookup,
  totalCost: number,
  reference: string,
  description: string,
  date: Date,
  createdBy: string
): Promise<{
  success: boolean
  journalEntry?: any
  message: string
  entries: IJournalEntryLine[]
}> {
  try {
    const entries: IJournalEntryLine[] = [
      {
        account_id: toLocationAccount.account_id,
        account_name: toLocationAccount.account_name,
        debit: totalCost,
        credit: 0,
      },
      {
        account_id: fromLocationAccount.account_id,
        account_name: fromLocationAccount.account_name,
        debit: 0,
        credit: totalCost,
      },
    ]

    // Validate double-entry accounting
    const totalDebit = entries.reduce((sum, entry) => sum + entry.debit, 0)
    const totalCredit = entries.reduce((sum, entry) => sum + entry.credit, 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Double-entry accounting violation: Total debit (${totalDebit}) must equal total credit (${totalCredit})`
      )
    }

    const journalEntry = await createJournalEntry({
      date,
      reference,
      description,
      entries,
      createdBy,
      source_module: 'inventory',
    })

    return {
      success: true,
      journalEntry,
      message: 'Inventory transfer journal entry created successfully',
      entries,
    }
  } catch (error: any) {
    console.error('Error generating inventory transfer journal entry:', error)
    return {
      success: false,
      message: error.message || 'Failed to generate inventory transfer journal entry',
      entries: [],
    }
  }
}

