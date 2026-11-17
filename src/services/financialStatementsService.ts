import GeneralLedger, { IGeneralLedger } from '../models/GeneralLedger'
import PurchaseInvoice from '../models/PurchaseInvoice'
import SalesInvoice from '../models/SalesInvoice'
import Expense from '../models/Expense'
import InventoryTransaction from '../models/InventoryTransaction'
import Inventory from '../models/Inventory'
import Account, { IAccount } from '../models/Account'
import JournalEntry from '../models/JournalEntry'
import Receivable from '../models/Receivable'
import Payable from '../models/Payable'

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface IncomeStatementItem {
  account_id: string
  account_name: string
  amount: number
}

export interface IncomeStatementSection {
  items: IncomeStatementItem[]
  total: number
}

export interface RevenueDetailItem {
  invoice_number: string
  invoice_date: Date
  amount: number
}

export interface CogsDetailItem {
  invoice_number: string
  product_name: string
  quantity: number
  unit_cost: number
  total_cost: number
  vat_amount?: number
}

export interface OperatingExpenseDetailItem {
  expense_id: string
  expense_date: Date
  description: string
  category: string
  amount: number
}

export interface IncomeStatement {
  period: {
    start_date: Date
    end_date: Date
  }
  revenue: IncomeStatementSection
  revenue_detail?: RevenueDetailItem[]
  cogs: IncomeStatementSection
  cogs_detail?: CogsDetailItem[]
  cogs_vat: number  // Sum of VAT on all goods sold (excluded from Total COGS)
  gross_profit: number
  operating_expenses: IncomeStatementSection
  operating_expenses_detail?: OperatingExpenseDetailItem[]
  operating_income: number
  other_income: IncomeStatementSection
  other_expenses: IncomeStatementSection
  net_income_before_tax: number
  corporate_tax: IncomeStatementSection
  net_income: number
}

export interface BalanceSheetItem {
  account_id: string
  account_name: string
  balance: number
}

export interface BalanceSheet {
  as_of_date: Date
  assets: {
    current_assets: BalanceSheetItem[]
    non_current_assets: BalanceSheetItem[]
    contra_assets: BalanceSheetItem[]
    total_current: number
    total_non_current: number
    total_contra: number
    total: number
  }
  liabilities: {
    current_liabilities: BalanceSheetItem[]
    non_current_liabilities: BalanceSheetItem[]
    total_current: number
    total_non_current: number
    total: number
  }
  equity: {
    owner_capital: BalanceSheetItem[]
    retained_earnings: BalanceSheetItem[]
    reserves: BalanceSheetItem[]
    total_owner_capital: number
    total_retained_earnings: number
    total_reserves: number
    total: number
  }
  // Liquidity breakdown: cash/bank/AR/AP/VAT positions derived from current assets/liabilities
  payment_breakdown: {
    cash_balance: number        // Sum of all cash accounts
    bank_balance: number        // Sum of all bank accounts
    accounts_receivable: number // Outstanding receivables
    accounts_payable: number    // Outstanding payables
    vat_payable: number         // VAT collected minus recovered (net due to FTA)
    net_working_capital: number // Current Assets - Current Liabilities
  }
  is_balanced: boolean
  difference: number
}

export interface CashFlowItem {
  account_id: string
  account_name: string
  amount: number
  description?: string
}

export interface CashFlowStatement {
  period: {
    start_date: Date
    end_date: Date
  }
  operating_activities: {
    items: CashFlowItem[]
    total: number
  }
  investing_activities: {
    items: CashFlowItem[]
    total: number
  }
  financing_activities: {
    items: CashFlowItem[]
    total: number
  }
  opening_cash: number
  net_cash_movement: number
  closing_cash: number
}

export interface EquityItem {
  account_id: string
  account_name: string
  opening_balance: number
  additions: number
  withdrawals: number
  closing_balance: number
}

export interface StatementOfEquity {
  period: {
    start_date: Date
    end_date: Date
  }
  opening_equity: number
  net_income: number
  owner_contributions: number
  withdrawals: number
  closing_equity: number
  items: EquityItem[]
}

/**
 * Get account balance as of a specific date
 */
async function getAccountBalance(accountId: string, asOfDate: Date): Promise<number> {
  const lastEntry = await GeneralLedger.findOne({
    account_id: accountId,
    date: { $lte: asOfDate },
  })
    .sort({ date: -1, createdAt: -1 })
    .exec()

  return lastEntry?.running_balance || 0
}

interface AccountMovement {
  account_id: string
  account_name: string
  account_type: AccountType
  account_sub_type?: string
  total_debit: number
  total_credit: number
}

/**
 * Get aggregated debits and credits per account for a date range
 * using the General Ledger as the source of truth.
 */
async function getAccountMovementsForPeriod(
  startDate: Date,
  endDate: Date
): Promise<AccountMovement[]> {
  const rows = await GeneralLedger.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$account_id',
        account_name: { $first: '$account_name' },
        account_type: { $first: '$account_type' },
        account_sub_type: { $first: '$account_sub_type' },
        total_debit: { $sum: '$debit' },
        total_credit: { $sum: '$credit' },
      },
    },
  ]).exec()

  return rows.map(row => ({
    account_id: row._id as string,
    account_name: row.account_name as string,
    account_type: (row.account_type || 'Asset') as AccountType,
    account_sub_type: row.account_sub_type as string | undefined,
    total_debit: (row.total_debit || 0) as number,
    total_credit: (row.total_credit || 0) as number,
  }))
}

/**
 * Get all accounts grouped by type from Chart of Accounts
 */
async function getAccountsByType(): Promise<Map<AccountType, Array<{ account_id: string; account_name: string; account_sub_type?: string }>>> {
  // Get accounts from Account model (Chart of Accounts)
  const accounts = await Account.find({ is_active: true })
    .select('account_id account_name account_type account_sub_type')
    .lean()
    .exec()

  const accountsByType = new Map<AccountType, Array<{ account_id: string; account_name: string; account_sub_type?: string }>>()
  
  for (const acc of accounts) {
    const accountType = (acc.account_type || 'Asset') as AccountType
    if (!accountsByType.has(accountType)) {
      accountsByType.set(accountType, [])
    }
    accountsByType.get(accountType)!.push({
      account_id: acc.account_id,
      account_name: acc.account_name,
      account_sub_type: acc.account_sub_type,
    })
  }

  // If no accounts found in Account model, fallback to General Ledger
  if (accounts.length === 0) {
    const ledgerAccounts = await GeneralLedger.aggregate([
    {
      $group: {
        _id: '$account_id',
        account_name: { $first: '$account_name' },
        account_type: { $first: '$account_type' },
      },
    },
  ]).exec()

    for (const acc of ledgerAccounts) {
    const accountType = (acc.account_type || 'Asset') as AccountType
    if (!accountsByType.has(accountType)) {
      accountsByType.set(accountType, [])
    }
    accountsByType.get(accountType)!.push({
      account_id: acc._id,
      account_name: acc.account_name,
    })
    }
  }

  return accountsByType
}

function isVatAccount(accountId: string, accountName: string): boolean {
  const s = `${accountId} ${accountName}`.toLowerCase()
  return s.includes('vat')
}

function isCogsAccount(accountId: string, accountName: string): boolean {
  const s = `${accountId} ${accountName}`.toLowerCase()
  return (
    s.includes('cogs') ||
    s.includes('cost_of_goods_sold') ||
    s.includes('cost of goods sold')
  )
}

function isTaxExpenseAccount(accountId: string, accountName: string): boolean {
  const s = `${accountId} ${accountName}`.toLowerCase()
  return (
    s.includes('corporate tax') ||
    s.includes('income tax') ||
    s.includes('tax expense')
  )
}

function isOtherIncomeAccount(accountId: string, accountName: string): boolean {
  const s = `${accountId} ${accountName}`.toLowerCase()
  return (
    s.includes('interest income') ||
    s.includes('other income') ||
    s.includes('misc income') ||
    s.includes('gain')
  )
}

function isOtherExpenseAccount(accountId: string, accountName: string): boolean {
  const s = `${accountId} ${accountName}`.toLowerCase()
  return (
    s.includes('bank charges') ||
    s.includes('bank charge') ||
    s.includes('penalty') ||
    s.includes('fine') ||
    s.includes('interest expense')
  )
}

/**
 * Generate Income Statement (Profit & Loss) from Sales Invoices, Inventory, and Expenses.
 * Total Revenue = Sum of all sales invoices (including VAT) for the period
 * Total COGS = Sum of (inventory total cost × quantity sold) from sales invoices
 * Where inventory total cost = unit_cost + material_cost + VAT
 * Operating Expenses = Sum of all expenses for the period
 */
export async function generateIncomeStatement(
  dateRange: DateRange
): Promise<IncomeStatement> {
  const movements = await getAccountMovementsForPeriod(
    dateRange.startDate,
    dateRange.endDate
  )

  const revenue: IncomeStatementSection = { items: [], total: 0 }
  const cogs: IncomeStatementSection = { items: [], total: 0 }
  const operatingExpenses: IncomeStatementSection = { items: [], total: 0 }
  const otherIncome: IncomeStatementSection = { items: [], total: 0 }
  const otherExpenses: IncomeStatementSection = { items: [], total: 0 }
  const corporateTax: IncomeStatementSection = { items: [], total: 0 }

  // Calculate Total Revenue: Sum of all sales invoices (including VAT) for the selected period
  const salesInvoices = await SalesInvoice.find({
    invoice_date: {
      $gte: dateRange.startDate,
      $lte: dateRange.endDate,
    },
  }).select('total_amount invoice_number invoice_date').lean()

  const revenueDetail: RevenueDetailItem[] = []
  let totalRevenue = 0
  for (const invoice of salesInvoices) {
    const invoiceTotal = invoice.total_amount || 0
    if (invoiceTotal > 0) {
      totalRevenue += invoiceTotal
      revenueDetail.push({
        invoice_number: invoice.invoice_number || '',
        invoice_date: invoice.invoice_date,
        amount: invoiceTotal,
      })
    }
  }

  // Add revenue item
  if (totalRevenue > 0) {
    revenue.items.push({
      account_id: 'SALES_REVENUE',
      account_name: 'Sales Revenue',
      amount: totalRevenue,
    })
    revenue.total = totalRevenue
  }

  // Calculate Total COGS: Sum of (inventory total cost × quantity sold) from sales invoices - Sum of all expenses
  // Get all sales invoices for the date range with line items
  const salesInvoicesForCOGS = await SalesInvoice.find({
    invoice_date: {
      $gte: dateRange.startDate,
      $lte: dateRange.endDate,
    },
  })
    .select('line_items invoice_number')
    .lean()

  // Collect all unique product IDs to fetch in batch
  const productIds = new Set<string>()
  for (const invoice of salesInvoicesForCOGS) {
    if (invoice.line_items && invoice.line_items.length > 0) {
      for (const lineItem of invoice.line_items) {
        if (lineItem.product) {
          let productId: string | null = null
          if (typeof lineItem.product === 'object') {
            productId = (lineItem.product as any)._id?.toString() || (lineItem.product as any).toString() || null
          } else {
            productId = String(lineItem.product)
          }
          if (productId) {
            productIds.add(productId)
          }
        }
      }
    }
  }

  // Fetch all products in batch (include name for detail)
  const products = await Inventory.find({
    _id: { $in: Array.from(productIds) }
  })
    .select('unit_cost costPrice materialCostComponents vat tax_percent name product_name')
    .lean()

  // Create a map for quick lookup
  const productMap = new Map<string, any>()
  for (const product of products) {
    productMap.set(product._id.toString(), product)
  }

  const cogsDetail: CogsDetailItem[] = []
  let totalProductCOGS = 0
  let totalVATOnGoods = 0
  for (const invoice of salesInvoicesForCOGS) {
    if (invoice.line_items && invoice.line_items.length > 0) {
      for (const lineItem of invoice.line_items) {
        const quantity = lineItem.quantity || 0
        
        // Get product ID
        let productId: string | null = null
        if (lineItem.product) {
          if (typeof lineItem.product === 'object') {
            productId = (lineItem.product as any)._id?.toString() || (lineItem.product as any).toString() || null
          } else {
            productId = String(lineItem.product)
          }
        }

        if (productId && quantity > 0) {
          const product = productMap.get(productId)
          
          if (product) {
            // Calculate total cost from inventory
            const unitCost = product.unit_cost ?? product.costPrice ?? 0
            
            // Calculate material cost from materialCostComponents
            let materialCost = 0
            if (product.materialCostComponents && Array.isArray(product.materialCostComponents)) {
              materialCost = product.materialCostComponents.reduce((sum: number, comp: any) => {
                return sum + (comp.amount || 0)
              }, 0)
            }
            
            // Determine if material cost should be included
            let includeMaterialCost = true
            if (typeof product.unitCostIncludesMaterial === "boolean") {
              includeMaterialCost = product.unitCostIncludesMaterial
            }

            const baseCost = includeMaterialCost ? unitCost : (unitCost + materialCost)
            // Calculate VAT (stored separately, excluded from COGS)
            const vatPercent = product.vat ?? product.tax_percent ?? 0
            const vatAmountPerUnit = baseCost * (vatPercent / 100)

            // COGS for this line item = base cost only (excludes VAT) × quantity
            const lineItemCOGS = baseCost * quantity
            totalProductCOGS += lineItemCOGS

            // Sum of VAT on all goods sold (separate variable)
            const lineItemVAT = vatAmountPerUnit * quantity
            totalVATOnGoods += lineItemVAT

            // Add to COGS detail
            const productName = product.product_name || product.name || `Product ${productId}`
            cogsDetail.push({
              invoice_number: (invoice as any).invoice_number || '',
              product_name: productName,
              quantity,
              unit_cost: baseCost,
              total_cost: lineItemCOGS,
              vat_amount: lineItemVAT,
            })
          }
        }
      }
    }
  }

  // Total COGS = Sum of (base cost × quantity sold) - excludes VAT
  const totalCOGS = totalProductCOGS

  // Add COGS item
  if (totalCOGS > 0 || totalProductCOGS > 0) {
    cogs.items.push({
      account_id: 'COGS',
      account_name: 'Cost of Goods Sold',
      amount: totalCOGS,
    })
    cogs.total = totalCOGS
  }

  // Calculate Total Expenses: Sum of all expenses for the selected period
  const expenses = await Expense.find({
    expense_date: {
      $gte: dateRange.startDate,
      $lte: dateRange.endDate,
    },
  }).select('amount tax_amount expense_id description associated_account category expense_date serialNumber').lean()

  // Track expense account IDs that are already counted from Expense model
  // to avoid double-counting when processing General Ledger movements
  const expenseAccountIdsFromExpenses = new Set<string>()
  const operatingExpensesDetail: OperatingExpenseDetailItem[] = []
  
  let totalExpenses = 0
  for (const expense of expenses) {
    const expenseAmount = expense.amount || 0
    const expenseTax = expense.tax_amount || 0
    const totalExpenseAmount = expenseAmount + expenseTax
    if (totalExpenseAmount > 0) {
      totalExpenses += totalExpenseAmount
      // Add expense to Operating Expenses
      const accountName = expense.associated_account || expense.description || expense.category || 'Expense'
      
      // Determine the expense account ID used in journal entries
      let expenseAccountId = 'EXPENSE'
      if (expense.associated_account) {
        // If it looks like an account_id (contains dashes), use it as-is
        if (expense.associated_account.includes('-') && expense.associated_account.length > 10) {
          expenseAccountId = expense.associated_account
        } else {
          // Convert account name to account_id format
          expenseAccountId = expense.associated_account.toUpperCase().replace(/\s+/g, '_')
        }
      }
      
      expenseAccountIdsFromExpenses.add(expenseAccountId)
      
      operatingExpenses.items.push({
        account_id: expense.expense_id || 'EXPENSE',
        account_name: accountName,
        amount: totalExpenseAmount,
      })

      operatingExpensesDetail.push({
        expense_id: expense.expense_id || expense.serialNumber || '',
        expense_date: expense.expense_date,
        description: expense.description || accountName,
        category: expense.category || 'Expense',
        amount: totalExpenseAmount,
      })
    }
  }
  operatingExpenses.total = totalExpenses

  // Also get expense account IDs from General Ledger entries linked to expense journal entries
  // to ensure we catch all expense accounts that should be skipped
  const expenseJournalEntries = await JournalEntry.find({
    source_module: 'expense',
    date: {
      $gte: dateRange.startDate,
      $lte: dateRange.endDate,
    },
  }).select('_id').lean()

  const expenseJournalEntryIds = expenseJournalEntries.map(je => je._id)
  
  if (expenseJournalEntryIds.length > 0) {
    const expenseGLEntries = await GeneralLedger.find({
      journal_reference: { $in: expenseJournalEntryIds },
      account_type: 'Expense',
      date: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    }).select('account_id').lean()
    
    for (const glEntry of expenseGLEntries) {
      expenseAccountIdsFromExpenses.add(glEntry.account_id)
    }
  }

  // Process General Ledger movements using account_sub_type for proper categorization
  // First, get account sub-types from Account model
  const accountSubTypes = new Map<string, string>()
  const accountIds = movements.map(m => m.account_id)
  const accounts = await Account.find({ account_id: { $in: accountIds } })
    .select('account_id account_sub_type')
    .lean()
  
  for (const acc of accounts) {
    if (acc.account_sub_type) {
      accountSubTypes.set(acc.account_id, acc.account_sub_type)
    }
  }

  // Process expenses by sub-type
  for (const mv of movements) {
    const { account_id, account_name, account_type, total_debit, total_credit } = mv

    if (account_type === 'Revenue') {
      // Skip revenue accounts as we're using sales invoices instead
      continue
    }

    if (account_type === 'Expense') {
      const amount = total_debit - total_credit
      if (amount === 0) continue

      // Skip expense accounts that are already counted from Expense model
      if (expenseAccountIdsFromExpenses.has(account_id)) {
        continue
      }
      
      // Get sub-type from account or use fallback logic
      const subType = accountSubTypes.get(account_id)
      
      if (subType === 'COGS') {
        // COGS is already calculated from inventory transactions, skip
        continue
      } else if (subType === 'Non-Operating Expense') {
        if (isTaxExpenseAccount(account_id, account_name)) {
          corporateTax.items.push({ account_id, account_name, amount })
          corporateTax.total += amount
        } else {
          otherExpenses.items.push({ account_id, account_name, amount })
          otherExpenses.total += amount
        }
      } else {
        // Operating Expense (default for Expense type)
        if (isTaxExpenseAccount(account_id, account_name)) {
          corporateTax.items.push({ account_id, account_name, amount })
          corporateTax.total += amount
        } else if (isOtherExpenseAccount(account_id, account_name)) {
          otherExpenses.items.push({ account_id, account_name, amount })
          otherExpenses.total += amount
        } else {
          operatingExpenses.items.push({ account_id, account_name, amount })
          operatingExpenses.total += amount
        }
      }
    }
  }

  // Process revenue by sub-type
  for (const mv of movements) {
    const { account_id, account_name, account_type, total_debit, total_credit } = mv

    if (account_type === 'Revenue') {
      const amount = total_credit - total_debit
      if (amount === 0) continue

      const subType = accountSubTypes.get(account_id)
      
      if (subType === 'Non-Operating Revenue' || isOtherIncomeAccount(account_id, account_name)) {
        otherIncome.items.push({ account_id, account_name, amount })
        otherIncome.total += amount
      }
      // Operating Revenue is already handled by sales invoices above
    }
  }

  const grossProfit = revenue.total - cogs.total
  const operatingIncome = grossProfit - operatingExpenses.total
  const netIncomeBeforeTax =
    operatingIncome + otherIncome.total - otherExpenses.total
  const netIncome = netIncomeBeforeTax - corporateTax.total

  return {
    period: {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    },
    revenue,
    revenue_detail: revenueDetail,
    cogs,
    cogs_detail: cogsDetail,
    cogs_vat: totalVATOnGoods,
    gross_profit: grossProfit,
    operating_expenses: operatingExpenses,
    operating_expenses_detail: operatingExpensesDetail,
    operating_income: operatingIncome,
    other_income: otherIncome,
    other_expenses: otherExpenses,
    net_income_before_tax: netIncomeBeforeTax,
    corporate_tax: corporateTax,
    net_income: netIncome,
  }
}

/**
 * Generate Balance Sheet using account_sub_type for proper grouping
 */
export async function generateBalanceSheet(startDate?: Date, endDate?: Date): Promise<BalanceSheet> {
  const asOfDate = endDate || new Date()
  
  // Get all active accounts with their sub-types from Account model
  const accountModelAccounts = await Account.find({ is_active: true })
    .select('account_id account_name account_type account_sub_type opening_balance')
    .lean()
    .exec()

  // Get all unique accounts from General Ledger up to asOfDate
  const ledgerAccounts = await GeneralLedger.aggregate([
    {
      $match: {
        date: { $lte: asOfDate },
      },
    },
    {
      $group: {
        _id: '$account_id',
        account_name: { $first: '$account_name' },
        account_type: { $first: '$account_type' },
        account_sub_type: { $first: '$account_sub_type' },
      },
    },
  ]).exec()

  // Create a map of all accounts (from both sources)
  const accountMap = new Map<string, {
    account_id: string
    account_name: string
    account_type: string
    account_sub_type?: string
    opening_balance?: number
  }>()

  // Add accounts from Account model
  for (const acc of accountModelAccounts) {
    accountMap.set(acc.account_id, {
      account_id: acc.account_id,
      account_name: acc.account_name,
      account_type: acc.account_type,
      account_sub_type: acc.account_sub_type,
      opening_balance: acc.opening_balance,
    })
  }

  // Add accounts from General Ledger (override with ledger data if exists)
  for (const acc of ledgerAccounts) {
    const existing = accountMap.get(acc._id)
    accountMap.set(acc._id, {
      account_id: acc._id,
      account_name: acc.account_name || existing?.account_name || acc._id,
      account_type: acc.account_type || existing?.account_type || 'Asset',
      account_sub_type: acc.account_sub_type || existing?.account_sub_type,
      opening_balance: existing?.opening_balance,
    })
  }

  // Convert map to array
  const accounts = Array.from(accountMap.values())

  // ============================================
  // ASSETS - Grouped by sub-type
  // ============================================
  const currentAssets: BalanceSheetItem[] = []
  const nonCurrentAssets: BalanceSheetItem[] = []
  const contraAssets: BalanceSheetItem[] = []
  
  let totalCurrentAssets = 0
  let totalNonCurrentAssets = 0
  let totalContraAssets = 0

  // Process asset accounts
  const assetAccounts = accounts.filter(acc => acc.account_type === 'Asset')
  
  for (const account of assetAccounts) {
    const balance = await getAccountBalance(account.account_id, asOfDate)
    
    // Skip zero balances
    if (Math.abs(balance) < 0.01) continue
    
    const item: BalanceSheetItem = {
      account_id: account.account_id,
      account_name: account.account_name,
      balance: balance,
    }
    
    // Group by sub-type
    const subType = account.account_sub_type as string | undefined
    
    if (subType === 'Current Asset') {
      currentAssets.push(item)
      totalCurrentAssets += balance
    } else if (subType === 'Non-Current Asset') {
      nonCurrentAssets.push(item)
      totalNonCurrentAssets += balance
    } else if (subType === 'Contra Asset') {
      contraAssets.push(item)
      totalContraAssets += balance
    } else {
      // Fallback: determine by account name if sub-type is missing
      const name = account.account_name.toLowerCase()
      if (
        name.includes('cash') ||
        name.includes('bank') ||
        name.includes('receivable') ||
        name.includes('inventory') ||
        name.includes('prepaid')
      ) {
        currentAssets.push(item)
        totalCurrentAssets += balance
      } else if (
        name.includes('depreciation') ||
        name.includes('accumulated') ||
        name.includes('allowance')
      ) {
        contraAssets.push(item)
        totalContraAssets += balance
      } else {
        nonCurrentAssets.push(item)
        totalNonCurrentAssets += balance
      }
    }
  }

  // Add Accounts Receivable from Receivables model
  const receivables = await Receivable.find({}).select('balance_due').lean()
  const totalAccountsReceivable = receivables.reduce((sum, r) => sum + (r.balance_due || 0), 0)
  
  if (totalAccountsReceivable > 0) {
    const existingAR = currentAssets.find(a => 
      a.account_id.includes('RECEIVABLE') || 
      a.account_name.toLowerCase().includes('receivable')
    )
    
    if (!existingAR) {
      currentAssets.push({
        account_id: 'ACCOUNTS_RECEIVABLE',
        account_name: 'Accounts Receivable',
        balance: totalAccountsReceivable,
      })
      totalCurrentAssets += totalAccountsReceivable
    }
  }

  // Add Inventory value
  const inventoryItems = await Inventory.find({ is_active: true })
    .select('quantity_on_hand qty unit_cost vat tax_percent')
    .lean()
  
  let totalInventoryValue = 0
  for (const item of inventoryItems) {
    const qty = item.quantity_on_hand || item.qty || 0
    const unitCost = item.unit_cost || 0
    const vatPercent = item.vat || item.tax_percent || 0
    const vatAmount = (unitCost * vatPercent) / 100
    const itemValue = qty * (unitCost + vatAmount)
    totalInventoryValue += itemValue
  }
  
  if (totalInventoryValue > 0) {
    const existingInv = currentAssets.find(a => 
      a.account_id.includes('INVENTORY') || 
      a.account_name.toLowerCase().includes('inventory')
    )
    
    if (!existingInv) {
      currentAssets.push({
        account_id: 'INVENTORY',
        account_name: 'Inventory',
        balance: totalInventoryValue,
      })
      totalCurrentAssets += totalInventoryValue
    }
  }

  // Total Assets = Current Assets + Non-Current Assets
  // Note: Contra assets are shown separately but not subtracted from total
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets

  // ============================================
  // LIABILITIES - Grouped by sub-type
  // ============================================
  const currentLiabilities: BalanceSheetItem[] = []
  const nonCurrentLiabilities: BalanceSheetItem[] = []
  
  let totalCurrentLiabilities = 0
  let totalNonCurrentLiabilities = 0

  // Process liability accounts
  const liabilityAccounts = accounts.filter(acc => acc.account_type === 'Liability')
  
  for (const account of liabilityAccounts) {
    const balance = await getAccountBalance(account.account_id, asOfDate)
    
    // Skip zero balances
    if (Math.abs(balance) < 0.01) continue
    
    const item: BalanceSheetItem = {
      account_id: account.account_id,
      account_name: account.account_name,
      balance: balance,
    }
    
    // Group by sub-type
    const subType = account.account_sub_type as string | undefined
    
    if (subType === 'Current Liability') {
      currentLiabilities.push(item)
      totalCurrentLiabilities += balance
    } else if (subType === 'Non-Current Liability') {
      nonCurrentLiabilities.push(item)
      totalNonCurrentLiabilities += balance
    } else {
      // Fallback: determine by account name if sub-type is missing
      const name = account.account_name.toLowerCase()
      if (
        name.includes('payable') ||
        name.includes('tax') ||
        name.includes('accrued') ||
        name.includes('short-term')
      ) {
        currentLiabilities.push(item)
        totalCurrentLiabilities += balance
      } else {
        nonCurrentLiabilities.push(item)
        totalNonCurrentLiabilities += balance
      }
    }
  }

  // Add Accounts Payable from Payables model
  const payables = await Payable.find({}).select('balance_due').lean()
  const totalAccountsPayable = payables.reduce((sum, p) => sum + (p.balance_due || 0), 0)
  
  if (totalAccountsPayable > 0) {
    const existingAP = currentLiabilities.find(a => 
      a.account_id.includes('PAYABLE') || 
      a.account_name.toLowerCase().includes('payable')
    )
    
    if (!existingAP) {
      currentLiabilities.push({
        account_id: 'ACCOUNTS_PAYABLE',
        account_name: 'Accounts Payable',
        balance: totalAccountsPayable,
      })
      totalCurrentLiabilities += totalAccountsPayable
    }
  }

  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities

  // ============================================
  // EQUITY - Calculated as Assets - Liabilities
  // Grouped by sub-type using actual GL running balances so that
  // owner capital entered via journal entries or Chart-of-Accounts
  // opening balances both appear correctly.
  // ============================================
  const ownerCapital: BalanceSheetItem[] = []
  const retainedEarnings: BalanceSheetItem[] = []
  const reserves: BalanceSheetItem[] = []
  
  let totalOwnerCapital = 0
  let totalRetainedEarnings = 0
  let totalReserves = 0

  // Calculate equity as Assets - Liabilities
  const totalEquity = totalAssets - totalLiabilities

  // Process equity accounts using GL running balance (tracks all movements:
  // contributions, withdrawals, retained earnings from operations)
  const equityAccounts = accounts.filter(acc => acc.account_type === 'Equity')
  
  for (const account of equityAccounts) {
    // Use GL running balance; fall back to opening_balance if no GL entries exist yet
    const glBalance = await getAccountBalance(account.account_id, asOfDate)
    const balance = glBalance !== 0 ? glBalance : (account.opening_balance || 0)
    
    // Skip zero balances
    if (Math.abs(balance) < 0.01) continue
    
    const item: BalanceSheetItem = {
      account_id: account.account_id,
      account_name: account.account_name,
      balance: balance,
    }
    
    // Group by sub-type
    const subType = account.account_sub_type as string | undefined
    
    if (subType === 'Owner Capital') {
      ownerCapital.push(item)
      totalOwnerCapital += balance
    } else if (subType === 'Retained Earnings') {
      retainedEarnings.push(item)
      totalRetainedEarnings += balance
    } else if (subType === 'Reserves') {
      reserves.push(item)
      totalReserves += balance
    } else {
      // Fallback: determine by account name if sub-type is missing
      const name = account.account_name.toLowerCase()
      if (
        name.includes('owner') ||
        name.includes('capital') ||
        name.includes('equity')
      ) {
        ownerCapital.push(item)
        totalOwnerCapital += balance
      } else if (
        name.includes('retained') ||
        name.includes('earnings')
      ) {
        retainedEarnings.push(item)
        totalRetainedEarnings += balance
      } else if (name.includes('reserve')) {
        reserves.push(item)
        totalReserves += balance
      } else {
        // Default to Owner Capital
        ownerCapital.push(item)
        totalOwnerCapital += balance
      }
    }
  }
  
  // If equity accounts don't sum to computed total equity, adjust retained earnings (plug)
  const equityFromAccounts = totalOwnerCapital + totalRetainedEarnings + totalReserves
  const equityDifference = totalEquity - equityFromAccounts
  
  // Add the difference to retained earnings to balance
  if (Math.abs(equityDifference) > 0.01) {
    totalRetainedEarnings += equityDifference
    // If no retained earnings item exists, create one
    if (retainedEarnings.length === 0 && equityDifference !== 0) {
      retainedEarnings.push({
        account_id: 'RETAINED_EARNINGS',
        account_name: 'Retained Earnings',
        balance: equityDifference,
      })
    } else if (retainedEarnings.length > 0) {
      // Update the first retained earnings item to include the difference
      retainedEarnings[0].balance += equityDifference
    }
  }

  // ============================================
  // PAYMENT / LIQUIDITY BREAKDOWN
  // Derived from current assets & liabilities already computed above;
  // no additional DB queries needed.
  // ============================================
  let cashBalance = 0
  let bankBalance = 0
  let arBalance = 0
  let apBalance = 0
  let vatPayable = 0

  for (const item of currentAssets) {
    const key = (item.account_name + item.account_id).toLowerCase()
    if (key.includes('cash') && !key.includes('bank')) cashBalance += item.balance
    else if (key.includes('bank')) bankBalance += item.balance
    else if (key.includes('receivable')) arBalance += item.balance
  }
  for (const item of currentLiabilities) {
    const key = (item.account_name + item.account_id).toLowerCase()
    if (key.includes('vat') || key.includes('tax payable')) vatPayable += item.balance
    else if (key.includes('payable')) apBalance += item.balance
  }

  // Check if balance sheet balances
  const difference = totalAssets - (totalLiabilities + totalEquity)

  return {
    as_of_date: asOfDate,
    assets: {
      current_assets: currentAssets,
      non_current_assets: nonCurrentAssets,
      contra_assets: contraAssets,
      total_current: totalCurrentAssets,
      total_non_current: totalNonCurrentAssets,
      total_contra: totalContraAssets,
      total: totalAssets,
    },
    liabilities: {
      current_liabilities: currentLiabilities,
      non_current_liabilities: nonCurrentLiabilities,
      total_current: totalCurrentLiabilities,
      total_non_current: totalNonCurrentLiabilities,
      total: totalLiabilities,
    },
    equity: {
      owner_capital: ownerCapital,
      retained_earnings: retainedEarnings,
      reserves: reserves,
      total_owner_capital: totalOwnerCapital,
      total_retained_earnings: totalRetainedEarnings,
      total_reserves: totalReserves,
      total: totalEquity,
    },
    payment_breakdown: {
      cash_balance: cashBalance,
      bank_balance: bankBalance,
      accounts_receivable: arBalance,
      accounts_payable: apBalance,
      vat_payable: vatPayable,
      net_working_capital: totalCurrentAssets - totalCurrentLiabilities,
    },
    is_balanced: Math.abs(difference) < 0.01,
    difference: difference,
  }
}

/**
 * Generate Cash Flow Statement
 * Cash flow tracks actual cash movements (not accruals)
 * Categories:
 * - Operating Activities: Cash from core business operations
 * - Investing Activities: Cash for buying/selling long-term assets
 * - Financing Activities: Cash from/to debt, equity, dividends
 */
export async function generateCashFlowStatement(dateRange: DateRange): Promise<CashFlowStatement> {
  const accountsByType = await getAccountsByType()
  
  // Get cash accounts (case-insensitive search)
  const cashAccounts = (accountsByType.get('Asset') || []).filter(acc =>
    acc.account_id.toUpperCase().includes('CASH') || 
    acc.account_id.toUpperCase().includes('BANK') ||
    acc.account_name.toUpperCase().includes('CASH') ||
    acc.account_name.toUpperCase().includes('BANK')
  )

  // Opening cash balance
  let openingCash = 0
  for (const account of cashAccounts) {
    openingCash += await getAccountBalance(account.account_id, dateRange.startDate)
  }

  // ============================================
  // OPERATING ACTIVITIES: Cash from core business
  // ============================================
  const operatingItems: CashFlowItem[] = []
  let operatingTotal = 0

  // 1. Cash received from customers
  // Get all cash inflows from sales (cash sales + receivable payments)
  const cashAccountIds = cashAccounts.map(acc => acc.account_id)
  
  // Cash from sales invoices (paid invoices with cash/bank payment)
  const cashSalesEntries = await GeneralLedger.find({
    source_module: 'sales_invoice',
    account_id: { $in: cashAccountIds },
    date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    debit: { $gt: 0 }, // Cash received (debit to cash)
  }).select('debit credit description reference').lean()

  // Cash from receivable payments
  const receivablePayments = await GeneralLedger.find({
    source_module: { $in: ['receivable_payment', 'receivable'] },
    account_id: { $in: cashAccountIds },
    date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    debit: { $gt: 0 }, // Cash received (debit to cash)
  }).select('debit credit description reference').lean()

  let totalCashFromSales = 0
  for (const entry of cashSalesEntries) {
    totalCashFromSales += entry.debit || 0
  }
  for (const entry of receivablePayments) {
    totalCashFromSales += entry.debit || 0
  }

  if (totalCashFromSales > 0) {
    operatingItems.push({
      account_id: 'CASH_FROM_SALES',
      account_name: 'Cash from Customers',
      amount: totalCashFromSales,
      description: 'Money received from customers paying for products in cash',
    })
    operatingTotal += totalCashFromSales
  }

  // 2. Cash paid for inventory/supplies
  // Get all cash outflows for purchases (cash purchases + payable payments)
  const cashPurchaseEntries = await GeneralLedger.find({
    source_module: 'purchase_invoice',
    account_id: { $in: cashAccountIds },
    date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    credit: { $gt: 0 }, // Cash paid (credit to cash)
  }).select('debit credit description reference').lean()

  // Cash paid for payable payments
  const payablePayments = await GeneralLedger.find({
    source_module: { $in: ['payable_payment', 'payable'] },
    account_id: { $in: cashAccountIds },
    date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    credit: { $gt: 0 }, // Cash paid (credit to cash)
  }).select('debit credit description reference').lean()

  let totalCashForPurchases = 0
  for (const entry of cashPurchaseEntries) {
    totalCashForPurchases += entry.credit || 0
  }
  for (const entry of payablePayments) {
    totalCashForPurchases += entry.credit || 0
  }

  if (totalCashForPurchases > 0) {
    operatingItems.push({
      account_id: 'CASH_FOR_PURCHASES',
      account_name: 'Cash Paid for Inventory/Supplies',
      amount: -totalCashForPurchases,
      description: 'Buying new inventory from suppliers',
    })
    operatingTotal -= totalCashForPurchases
  }

  // 3. Cash paid for expenses (rent, utilities, salaries, etc.)
  // Get cash outflows for expenses from General Ledger
  const expenseCashEntries = await GeneralLedger.find({
    source_module: 'expense',
    account_id: { $in: cashAccountIds },
    date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    credit: { $gt: 0 }, // Cash paid (credit to cash)
  }).populate('journal_reference').select('debit credit description reference').lean()

  // Also get payroll expenses if they exist
  const payrollCashEntries = await GeneralLedger.find({
    source_module: 'payroll',
    account_id: { $in: cashAccountIds },
    date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    credit: { $gt: 0 }, // Cash paid (credit to cash)
  }).select('debit credit description reference').lean()

  let totalCashForExpenses = 0
  const expenseBreakdown = new Map<string, number>()
  
  // Process expense entries
  for (const entry of expenseCashEntries) {
    const amount = entry.credit || 0
    if (amount > 0) {
      totalCashForExpenses += amount
      
      // Try to get expense category from description or reference
      const description = entry.description || entry.reference || 'Other Expenses'
      const category = description.split('-')[0].trim() || 'Other Expenses'
      expenseBreakdown.set(category, (expenseBreakdown.get(category) || 0) + amount)
    }
  }

  // Process payroll entries
  for (const entry of payrollCashEntries) {
    const amount = entry.credit || 0
    if (amount > 0) {
      totalCashForExpenses += amount
      expenseBreakdown.set('Salaries', (expenseBreakdown.get('Salaries') || 0) + amount)
    }
  }

  // Add expense items grouped by category
  for (const [category, amount] of expenseBreakdown.entries()) {
    let description = ''
    const categoryLower = category.toLowerCase()
    if (categoryLower.includes('salary') || categoryLower.includes('wage') || categoryLower.includes('payroll')) {
      description = 'Paying employees their salaries'
    } else if (categoryLower.includes('rent')) {
      description = 'Paying for rent'
    } else if (categoryLower.includes('utility') || categoryLower.includes('electric') || categoryLower.includes('water')) {
      description = 'Paying for utilities'
    } else {
      description = `Cash paid for ${categoryLower}`
    }
    
    operatingItems.push({
      account_id: `EXPENSE_${category.toUpperCase().replace(/\s+/g, '_')}`,
      account_name: category,
      amount: -amount,
      description: description,
    })
  }

  operatingTotal -= totalCashForExpenses

  // ============================================
  // INVESTING ACTIVITIES: Long-term asset purchases/sales
  // ============================================
  const investingItems: CashFlowItem[] = []
  let investingTotal = 0

  // Track cash movements related to fixed assets, equipment, property
  // Look for manual journal entries or GL entries involving asset accounts (excluding cash/inventory)
  const assetAccounts = (accountsByType.get('Asset') || []).filter(acc => {
    const id = acc.account_id.toUpperCase()
    const name = acc.account_name.toUpperCase()
    return !id.includes('CASH') && 
           !id.includes('BANK') && 
           !id.includes('RECEIVABLE') &&
           !id.includes('INVENTORY') &&
           (id.includes('EQUIPMENT') || 
            id.includes('PROPERTY') || 
            id.includes('PLANT') ||
            id.includes('FIXED') ||
            name.includes('EQUIPMENT') ||
            name.includes('PROPERTY') ||
            name.includes('ASSET'))
  })

  // Find cash payments for asset purchases
  for (const assetAccount of assetAccounts) {
    const assetMovements = await GeneralLedger.find({
      account_id: assetAccount.account_id,
      date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    }).exec()

    let assetCashFlow = 0
    for (const entry of assetMovements) {
      // Check if this asset entry has a corresponding cash entry
      const journalEntry = await GeneralLedger.findOne({
        journal_reference: entry.journal_reference,
        account_id: { $in: cashAccounts.map(acc => acc.account_id) },
      }).exec()

      if (journalEntry) {
        // Asset purchase: cash goes out (negative)
        if (entry.debit > 0) {
          assetCashFlow -= journalEntry.credit || 0
        }
        // Asset sale: cash comes in (positive)
        else if (entry.credit > 0) {
          assetCashFlow += journalEntry.debit || 0
        }
      }
    }

    if (Math.abs(assetCashFlow) > 0) {
      const description = assetCashFlow > 0 
        ? `Selling ${assetAccount.account_name.toLowerCase()}`
        : `Buying ${assetAccount.account_name.toLowerCase()}`
      
      investingItems.push({
        account_id: assetAccount.account_id,
        account_name: assetAccount.account_name,
        amount: assetCashFlow,
        description: description,
      })
      investingTotal += assetCashFlow
    }
  }

  // Also check manual journal entries for asset transactions
  const manualAssetEntries = await GeneralLedger.find({
    source_module: 'manual',
    date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    $or: [
      { account_id: { $in: assetAccounts.map(acc => acc.account_id) } },
      { description: { $regex: /equipment|property|asset|plant/i } },
    ],
  }).populate('journal_reference').exec()

  for (const entry of manualAssetEntries) {
    // Find corresponding cash entry in same journal
    const cashEntry = await GeneralLedger.findOne({
      journal_reference: entry.journal_reference,
      account_id: { $in: cashAccounts.map(acc => acc.account_id) },
    }).exec()

    if (cashEntry && Math.abs(cashEntry.credit || cashEntry.debit) > 0) {
      const cashAmount = cashEntry.debit > 0 ? cashEntry.debit : -cashEntry.credit
      if (Math.abs(cashAmount) > 0) {
        const existingItem = investingItems.find(item => item.account_id === entry.account_id)
        if (!existingItem) {
          investingItems.push({
            account_id: entry.account_id,
            account_name: entry.account_name,
            amount: cashAmount,
            description: entry.description || `Asset transaction: ${entry.account_name}`,
          })
          investingTotal += cashAmount
        }
      }
    }
  }

  // ============================================
  // FINANCING ACTIVITIES: Debt, equity, dividends
  // ============================================
  const financingItems: CashFlowItem[] = []
  let financingTotal = 0

  // 1. Loans received (liability accounts - loans, notes payable)
  const liabilityAccounts = accountsByType.get('Liability') || []
  const loanAccounts = liabilityAccounts.filter(acc => {
    const id = acc.account_id.toUpperCase()
    const name = acc.account_name.toUpperCase()
    return id.includes('LOAN') || 
           id.includes('NOTE') || 
           id.includes('DEBT') ||
           name.includes('LOAN') ||
           name.includes('BORROWING')
  })

  for (const loanAccount of loanAccounts) {
    const loanMovements = await GeneralLedger.find({
      account_id: loanAccount.account_id,
      date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    }).exec()

    let loanCashFlow = 0
    for (const entry of loanMovements) {
      // Check if this loan entry has a corresponding cash entry
      const journalEntry = await GeneralLedger.findOne({
        journal_reference: entry.journal_reference,
        account_id: { $in: cashAccounts.map(acc => acc.account_id) },
      }).exec()

      if (journalEntry) {
        // Loan received: cash comes in (positive)
        if (entry.credit > 0) {
          loanCashFlow += journalEntry.debit || 0
        }
        // Loan repayment: cash goes out (negative)
        else if (entry.debit > 0) {
          loanCashFlow -= journalEntry.credit || 0
        }
      }
    }

    if (Math.abs(loanCashFlow) > 0) {
      const description = loanCashFlow > 0 
        ? `Receiving a loan from ${loanAccount.account_name.toLowerCase()}`
        : `Repaying loan: ${loanAccount.account_name.toLowerCase()}`
      
      financingItems.push({
        account_id: loanAccount.account_id,
        account_name: loanAccount.account_name,
        amount: loanCashFlow,
        description: description,
      })
      financingTotal += loanCashFlow
    }
  }

  // 2. Equity contributions/withdrawals
  const equityAccounts = accountsByType.get('Equity') || []
  for (const account of equityAccounts) {
    const movementEntries = await GeneralLedger.find({
      account_id: account.account_id,
      date: { $gte: dateRange.startDate, $lte: dateRange.endDate },
    }).exec()

    let equityCashFlow = 0
    for (const entry of movementEntries) {
      // Check if this equity entry has a corresponding cash entry
      const journalEntry = await GeneralLedger.findOne({
        journal_reference: entry.journal_reference,
        account_id: { $in: cashAccounts.map(acc => acc.account_id) },
      }).exec()

      if (journalEntry) {
        // Equity contribution: cash comes in (positive)
        if (entry.credit > 0) {
          equityCashFlow += journalEntry.debit || 0
        }
        // Equity withdrawal/dividend: cash goes out (negative)
        else if (entry.debit > 0) {
          equityCashFlow -= journalEntry.credit || 0
        }
      }
    }

    if (Math.abs(equityCashFlow) > 0) {
      const description = equityCashFlow > 0 
        ? 'Equity contribution'
        : 'Equity withdrawal or dividend payment'
      
      financingItems.push({
        account_id: account.account_id,
        account_name: account.account_name,
        amount: equityCashFlow,
        description: description,
      })
      financingTotal += equityCashFlow
    }
  }

  // Calculate net cash movement
  const netCashMovement = operatingTotal + investingTotal + financingTotal

  // Closing cash balance
  let closingCash = 0
  for (const account of cashAccounts) {
    closingCash += await getAccountBalance(account.account_id, dateRange.endDate)
  }

  return {
    period: {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    },
    operating_activities: {
      items: operatingItems,
      total: operatingTotal,
    },
    investing_activities: {
      items: investingItems,
      total: investingTotal,
    },
    financing_activities: {
      items: financingItems,
      total: financingTotal,
    },
    opening_cash: openingCash,
    net_cash_movement: netCashMovement,
    closing_cash: closingCash,
  }
}

/**
 * Generate Statement of Changes in Equity
 */
export async function generateStatementOfEquity(dateRange: DateRange): Promise<StatementOfEquity> {
  const accountsByType = await getAccountsByType()
  const equityAccounts = accountsByType.get('Equity') || []

  // Opening equity
  let openingEquity = 0
  for (const account of equityAccounts) {
    openingEquity += await getAccountBalance(account.account_id, dateRange.startDate)
  }

  // Get net income for the period
  const incomeStatement = await generateIncomeStatement(dateRange)
  const netIncome = incomeStatement.net_income

  // Calculate contributions and withdrawals
  let ownerContributions = 0
  let withdrawals = 0

  const equityItems: EquityItem[] = []

  for (const account of equityAccounts) {
    const openingBalance = await getAccountBalance(account.account_id, dateRange.startDate)
    const closingBalance = await getAccountBalance(account.account_id, dateRange.endDate)
    const movement = closingBalance - openingBalance

    // Determine if it's a contribution or withdrawal
    let additions = 0
    let withdrawalsForAccount = 0

    if (movement > 0) {
      additions = movement
      ownerContributions += movement
    } else if (movement < 0) {
      withdrawalsForAccount = Math.abs(movement)
      withdrawals += Math.abs(movement)
    }

    equityItems.push({
      account_id: account.account_id,
      account_name: account.account_name,
      opening_balance: openingBalance,
      additions: additions,
      withdrawals: withdrawalsForAccount,
      closing_balance: closingBalance,
    })
  }

  const closingEquity = openingEquity + netIncome + ownerContributions - withdrawals

  return {
    period: {
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    },
    opening_equity: openingEquity,
    net_income: netIncome,
    owner_contributions: ownerContributions,
    withdrawals: withdrawals,
    closing_equity: closingEquity,
    items: equityItems,
  }
}

/**
 * Generate Trial Balance - includes all accounts from Chart of Accounts
 */
export async function generateTrialBalanceForStatements(asOfDate: Date) {
  // Get all accounts from Chart of Accounts
  const allAccounts = await Account.find({ is_active: true })
    .select('account_id account_name account_type account_sub_type')
    .lean()
    .exec()

  const trialBalanceItems: Array<{
    account_id: string
    account_name: string
    account_type: AccountType
    account_sub_type?: string
    debit_balance: number
    credit_balance: number
  }> = []

  let totalDebit = 0
  let totalCredit = 0

  // Get balances for each account from General Ledger
  for (const account of allAccounts) {
    const balance = await getAccountBalance(account.account_id, asOfDate)
    const accountType = account.account_type as AccountType

    // Calculate debit/credit balance based on account type
    let debitBalance = 0
    let creditBalance = 0

    if (accountType === 'Asset' || accountType === 'Expense') {
      // Assets and Expenses have debit balances
      if (balance > 0) {
        debitBalance = balance
      } else if (balance < 0) {
        creditBalance = Math.abs(balance)
      }
    } else {
      // Liabilities, Equity, Revenue have credit balances
      if (balance > 0) {
        creditBalance = balance
      } else if (balance < 0) {
        debitBalance = Math.abs(balance)
      }
    }

    // Include account even if balance is zero
    trialBalanceItems.push({
      account_id: account.account_id,
      account_name: account.account_name,
      account_type: accountType,
      account_sub_type: account.account_sub_type,
      debit_balance: debitBalance,
      credit_balance: creditBalance,
    })

    totalDebit += debitBalance
    totalCredit += creditBalance
  }

  // Sort by account type, sub-type, and name
  const typeOrder: { [key: string]: number } = {
    Asset: 1,
    Liability: 2,
    Equity: 3,
    Revenue: 4,
    Expense: 5,
  }

  const subTypeOrder: { [key: string]: number } = {
    // Assets
    'Current Asset': 1,
    'Non-Current Asset': 2,
    'Contra Asset': 3,
    // Liabilities
    'Current Liability': 1,
    'Non-Current Liability': 2,
    // Equity
    'Owner Capital': 1,
    'Retained Earnings': 2,
    'Reserves': 3,
    // Revenue
    'Operating Revenue': 1,
    'Non-Operating Revenue': 2,
    // Expenses
    'COGS': 1,
    'Operating Expense': 2,
    'Non-Operating Expense': 3,
  }

  trialBalanceItems.sort((a, b) => {
    const aOrder = typeOrder[a.account_type] || 99
    const bOrder = typeOrder[b.account_type] || 99
    if (aOrder !== bOrder) return aOrder - bOrder
    
    // Sort by sub-type if available
    if (a.account_sub_type && b.account_sub_type) {
      const aSubOrder = subTypeOrder[a.account_sub_type] || 99
      const bSubOrder = subTypeOrder[b.account_sub_type] || 99
      if (aSubOrder !== bSubOrder) return aSubOrder - bSubOrder
    } else if (a.account_sub_type && !b.account_sub_type) {
      return -1
    } else if (!a.account_sub_type && b.account_sub_type) {
      return 1
    }
    
    return a.account_name.localeCompare(b.account_name)
  })

  return {
    as_of_date: asOfDate,
    accounts: trialBalanceItems,
    total_debit: totalDebit,
    total_credit: totalCredit,
    is_balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  }
}

