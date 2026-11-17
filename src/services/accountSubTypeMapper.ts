import { AccountType, AccountSubType } from '../models/Account'

/**
 * Maps account names and types to their appropriate sub-types
 * This is used for migration and default account creation
 */
export function getAccountSubType(
  accountName: string,
  accountType: AccountType
): AccountSubType {
  const name = accountName.toLowerCase()
  
  switch (accountType) {
    case 'Asset':
      // Current Assets
      if (
        name.includes('cash') ||
        name.includes('bank') ||
        name.includes('accounts receivable') ||
        name.includes('receivable') ||
        name.includes('inventory') ||
        name.includes('prepaid') ||
        name.includes('short-term') ||
        name.includes('current')
      ) {
        return 'Current Asset'
      }
      // Contra Assets
      if (
        name.includes('depreciation') ||
        name.includes('accumulated') ||
        name.includes('allowance') ||
        name.includes('contra')
      ) {
        return 'Contra Asset'
      }
      // Non-Current Assets (default for Asset)
      return 'Non-Current Asset'
      
    case 'Liability':
      // Current Liabilities
      if (
        name.includes('accounts payable') ||
        name.includes('payable') ||
        name.includes('tax payable') ||
        name.includes('vat payable') ||
        name.includes('accrued') ||
        name.includes('short-term') ||
        name.includes('current') ||
        name.includes('advance payment') ||
        name.includes('customer advance')
      ) {
        return 'Current Liability'
      }
      // Non-Current Liabilities (default for Liability)
      return 'Non-Current Liability'
      
    case 'Equity':
      // Owner Capital
      if (
        name.includes('owner') ||
        name.includes('capital') ||
        name.includes('share capital') ||
        name.includes('equity')
      ) {
        return 'Owner Capital'
      }
      // Retained Earnings
      if (
        name.includes('retained') ||
        name.includes('earnings') ||
        name.includes('current year earnings')
      ) {
        return 'Retained Earnings'
      }
      // Reserves
      if (name.includes('reserve')) {
        return 'Reserves'
      }
      // Default to Owner Capital
      return 'Owner Capital'
      
    case 'Revenue':
      // Operating Revenue
      if (
        name.includes('sales') ||
        name.includes('service') ||
        name.includes('operating') ||
        name.includes('revenue') ||
        name.includes('income')
      ) {
        return 'Operating Revenue'
      }
      // Non-Operating Revenue
      if (
        name.includes('interest') ||
        name.includes('other income') ||
        name.includes('gain') ||
        name.includes('non-operating')
      ) {
        return 'Non-Operating Revenue'
      }
      // Default to Operating Revenue
      return 'Operating Revenue'
      
    case 'Expense':
      // COGS
      if (
        name.includes('cogs') ||
        name.includes('cost of goods') ||
        name.includes('cost of goods sold')
      ) {
        return 'COGS'
      }
      // Operating Expenses
      if (
        name.includes('rent') ||
        name.includes('utilities') ||
        name.includes('salaries') ||
        name.includes('supplies') ||
        name.includes('marketing') ||
        name.includes('operating') ||
        name.includes('expense')
      ) {
        return 'Operating Expense'
      }
      // Non-Operating Expenses
      if (
        name.includes('interest expense') ||
        name.includes('bank charges') ||
        name.includes('penalty') ||
        name.includes('fine') ||
        name.includes('non-operating')
      ) {
        return 'Non-Operating Expense'
      }
      // Default to Operating Expense
      return 'Operating Expense'
      
    default:
      // Fallback - should not happen
      throw new Error(`Unknown account type: ${accountType}`)
  }
}

/**
 * Get default sub-type for an account type (used when sub-type cannot be determined)
 */
export function getDefaultSubType(accountType: AccountType): AccountSubType {
  switch (accountType) {
    case 'Asset':
      return 'Current Asset'
    case 'Liability':
      return 'Current Liability'
    case 'Equity':
      return 'Owner Capital'
    case 'Revenue':
      return 'Operating Revenue'
    case 'Expense':
      return 'Operating Expense'
  }
}


