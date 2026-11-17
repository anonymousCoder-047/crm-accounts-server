import GeneralLedger, { IGeneralLedger } from '../models/GeneralLedger'
import { FilterQuery } from 'mongoose'

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

export interface LedgerFilters {
  account_id?: string
  account_name?: string
  account_type?: AccountType
  startDate?: Date
  endDate?: Date
  source_module?: string
}

export interface AccountLedgerSummary {
  account_id: string
  account_name: string
  account_type?: AccountType
  account_sub_type?: string
  opening_balance: number
  total_debit: number
  total_credit: number
  closing_balance: number
  entries: IGeneralLedger[]
}

export interface TrialBalanceItem {
  account_id: string
  account_name: string
  account_type?: AccountType
  debit_balance: number
  credit_balance: number
}

export interface TrialBalance {
  as_of_date: Date
  accounts: TrialBalanceItem[]
  total_debit: number
  total_credit: number
  is_balanced: boolean
}

export interface DateRangeSummary {
  start_date: Date
  end_date: Date
  total_debit: number
  total_credit: number
  entries_count: number
  accounts_affected: number
  by_account_type: {
    [key in AccountType]?: {
      total_debit: number
      total_credit: number
      accounts_count: number
    }
  }
}

/**
 * Get account-wise ledger with running balances
 */
export async function getAccountLedger(
  accountId: string,
  filters?: { startDate?: Date; endDate?: Date }
): Promise<AccountLedgerSummary> {
  const query: FilterQuery<IGeneralLedger> = { account_id: accountId }

  if (filters?.startDate || filters?.endDate) {
    query.date = {}
    if (filters.startDate) {
      query.date.$gte = filters.startDate
    }
    if (filters.endDate) {
      query.date.$lte = filters.endDate
    }
  }

  const entries = await GeneralLedger.find(query)
    .populate('journal_reference')
    .sort({ date: 1, createdAt: 1 })
    .exec()

  if (entries.length === 0) {
    // Return empty summary if no entries
    const firstEntry = await GeneralLedger.findOne({ account_id: accountId })
      .sort({ date: 1 })
      .exec()
    
    return {
      account_id: accountId,
      account_name: firstEntry?.account_name || accountId,
      account_type: firstEntry?.account_type,
      account_sub_type: firstEntry?.account_sub_type,
      opening_balance: 0,
      total_debit: 0,
      total_credit: 0,
      closing_balance: 0,
      entries: [],
    }
  }

  const accountName = entries[0].account_name
  const accountType = entries[0].account_type
  const accountSubType = entries[0].account_sub_type

  // Calculate opening balance (balance before start date if filtered)
  let openingBalance = 0
  if (filters?.startDate) {
    const beforeEntries = await GeneralLedger.find({
      account_id: accountId,
      date: { $lt: filters.startDate },
    })
      .sort({ date: -1, createdAt: -1 })
      .limit(1)
      .exec()
    
    if (beforeEntries.length > 0) {
      openingBalance = beforeEntries[0].running_balance
    }
  } else {
    // If no start date filter, opening balance is 0 (or first entry's balance minus its impact)
    if (entries.length > 0) {
      const firstEntry = entries[0]
      openingBalance = firstEntry.running_balance - (firstEntry.debit - firstEntry.credit)
      if (accountType === 'Liability' || accountType === 'Equity' || accountType === 'Revenue') {
        openingBalance = firstEntry.running_balance - (firstEntry.credit - firstEntry.debit)
      }
    }
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0)
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0)
  const closingBalance = entries[entries.length - 1].running_balance

  return {
    account_id: accountId,
    account_name: accountName,
    account_type: accountType,
    account_sub_type: accountSubType,
    opening_balance: openingBalance,
    total_debit: totalDebit,
    total_credit: totalCredit,
    closing_balance: closingBalance,
    entries,
  }
}

/**
 * List ledger entries with filters
 */
export async function listLedgerEntries(
  filters: LedgerFilters = {}
): Promise<IGeneralLedger[]> {
  const query: FilterQuery<IGeneralLedger> = {}

  if (filters.account_id) {
    query.account_id = filters.account_id
  }

  if (filters.account_name) {
    query.account_name = { $regex: filters.account_name, $options: 'i' }
  }

  if (filters.account_type) {
    query.account_type = filters.account_type
  }

  if (filters.startDate || filters.endDate) {
    query.date = {}
    if (filters.startDate) {
      query.date.$gte = filters.startDate
    }
    if (filters.endDate) {
      query.date.$lte = filters.endDate
    }
  }

  if (filters.source_module) {
    query.source_module = filters.source_module
  }

  return GeneralLedger.find(query)
    .populate('journal_reference')
    .sort({ date: -1, createdAt: -1 })
    .exec()
}

/**
 * Generate trial balance as of a specific date
 */
export async function generateTrialBalance(asOfDate?: Date): Promise<TrialBalance> {
  const query: FilterQuery<IGeneralLedger> = {}
  
  if (asOfDate) {
    query.date = { $lte: asOfDate }
  }

  // Get all unique accounts with their latest balance
  const allEntries = await GeneralLedger.find(query)
    .sort({ date: -1, createdAt: -1 })
    .exec()

  // Group by account_id and get the latest entry for each account
  const accountMap = new Map<string, IGeneralLedger>()
  
  for (const entry of allEntries) {
    if (!accountMap.has(entry.account_id)) {
      accountMap.set(entry.account_id, entry)
    }
  }

  const trialBalanceItems: TrialBalanceItem[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const entry of accountMap.values()) {
    const accountType = entry.account_type || 'Asset'
    
    // Calculate debit/credit balance based on account type
    let debitBalance = 0
    let creditBalance = 0

    if (accountType === 'Asset' || accountType === 'Expense') {
      // Assets and Expenses have debit balances
      if (entry.running_balance > 0) {
        debitBalance = entry.running_balance
      } else {
        creditBalance = Math.abs(entry.running_balance)
      }
    } else {
      // Liabilities, Equity, Revenue have credit balances
      if (entry.running_balance > 0) {
        creditBalance = entry.running_balance
      } else {
        debitBalance = Math.abs(entry.running_balance)
      }
    }

    trialBalanceItems.push({
      account_id: entry.account_id,
      account_name: entry.account_name,
      account_type: accountType,
      debit_balance: debitBalance,
      credit_balance: creditBalance,
    })

    totalDebit += debitBalance
    totalCredit += creditBalance
  }

  // Sort by account type and name
  trialBalanceItems.sort((a, b) => {
    const typeOrder: { [key: string]: number } = {
      Asset: 1,
      Liability: 2,
      Equity: 3,
      Revenue: 4,
      Expense: 5,
    }
    const aOrder = typeOrder[a.account_type || 'Asset'] || 99
    const bOrder = typeOrder[b.account_type || 'Asset'] || 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.account_name.localeCompare(b.account_name)
  })

  return {
    as_of_date: asOfDate || new Date(),
    accounts: trialBalanceItems,
    total_debit: totalDebit,
    total_credit: totalCredit,
    is_balanced: Math.abs(totalDebit - totalCredit) < 0.01, // Allow small floating point differences
  }
}

/**
 * Get date range summary
 */
export async function getDateRangeSummary(
  startDate: Date,
  endDate: Date
): Promise<DateRangeSummary> {
  const entries = await GeneralLedger.find({
    date: { $gte: startDate, $lte: endDate },
  }).exec()

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0)
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0)
  
  const accountIds = new Set(entries.map(e => e.account_id))
  const accountsAffected = accountIds.size

  // Group by account type
  const byAccountType: { [key in AccountType]?: { total_debit: number; total_credit: number; accounts_count: number } } = {}
  const accountsByType = new Map<AccountType, Set<string>>()

  for (const entry of entries) {
    const accountType = entry.account_type || 'Asset'
    
    if (!accountsByType.has(accountType)) {
      accountsByType.set(accountType, new Set())
    }
    accountsByType.get(accountType)!.add(entry.account_id)

    if (!byAccountType[accountType]) {
      byAccountType[accountType] = {
        total_debit: 0,
        total_credit: 0,
        accounts_count: 0,
      }
    }

    byAccountType[accountType]!.total_debit += entry.debit
    byAccountType[accountType]!.total_credit += entry.credit
  }

  // Set accounts count for each type
  for (const [accountType, accountSet] of accountsByType.entries()) {
    if (byAccountType[accountType]) {
      byAccountType[accountType]!.accounts_count = accountSet.size
    }
  }

  return {
    start_date: startDate,
    end_date: endDate,
    total_debit: totalDebit,
    total_credit: totalCredit,
    entries_count: entries.length,
    accounts_affected: accountsAffected,
    by_account_type: byAccountType,
  }
}

/**
 * Get all unique accounts
 */
export async function getAllAccounts(): Promise<Array<{ account_id: string; account_name: string; account_type?: AccountType }>> {
  const accounts = await GeneralLedger.aggregate([
    {
      $group: {
        _id: '$account_id',
        account_name: { $first: '$account_name' },
        account_type: { $first: '$account_type' },
      },
    },
    {
      $project: {
        _id: 0,
        account_id: '$_id',
        account_name: 1,
        account_type: 1,
      },
    },
    {
      $sort: { account_name: 1 },
    },
  ]).exec()

  return accounts
}

/**
 * Get ledger entry by ID
 */
export async function getLedgerEntryById(id: string): Promise<IGeneralLedger | null> {
  return GeneralLedger.findById(id).populate('journal_reference').exec()
}

/**
 * Update a general ledger entry and recalculate running balances
 * Note: This should be used with caution as ledger entries are typically auto-generated
 */
export async function updateLedgerEntry(
  id: string,
  updates: Partial<{
    account_id: string
    account_name: string
    account_type: AccountType
    date: Date
    debit: number
    credit: number
    description: string
    reference: string
  }>
): Promise<IGeneralLedger | null> {
  const ledgerEntry = await GeneralLedger.findById(id)
  if (!ledgerEntry) {
    return null
  }

  const originalDate = ledgerEntry.date
  const originalAccountId = ledgerEntry.account_id

  // Update fields
  if (updates.account_id !== undefined) ledgerEntry.account_id = updates.account_id
  if (updates.account_name !== undefined) ledgerEntry.account_name = updates.account_name
  if (updates.account_type !== undefined) ledgerEntry.account_type = updates.account_type
  if (updates.date !== undefined) ledgerEntry.date = updates.date
  if (updates.debit !== undefined) ledgerEntry.debit = updates.debit
  if (updates.credit !== undefined) ledgerEntry.credit = updates.credit
  if (updates.description !== undefined) ledgerEntry.description = updates.description
  if (updates.reference !== undefined) ledgerEntry.reference = updates.reference

  const savedEntry = await ledgerEntry.save()

  // Recalculate running balances for the account
  // Use the earlier of original date or new date to ensure all affected entries are recalculated
  const recalcDate = updates.date && updates.date < originalDate ? updates.date : originalDate
  await recalculateAccountRunningBalances(ledgerEntry.account_id, recalcDate)

  // If account changed, also recalculate the original account
  if (updates.account_id && updates.account_id !== originalAccountId) {
    await recalculateAccountRunningBalances(originalAccountId, originalDate)
  }

  return savedEntry.populate('journal_reference')
}

/**
 * Delete a general ledger entry and recalculate running balances
 * Note: This should be used with caution as ledger entries are typically auto-generated
 */
export async function deleteLedgerEntry(id: string): Promise<IGeneralLedger | null> {
  const ledgerEntry = await GeneralLedger.findById(id)
  if (!ledgerEntry) {
    return null
  }

  const accountId = ledgerEntry.account_id
  const entryDate = ledgerEntry.date

  // Delete the entry
  const deleted = await GeneralLedger.findByIdAndDelete(id)

  if (deleted) {
    // Recalculate running balances for the account
    await recalculateAccountRunningBalances(accountId, entryDate)
  }

  return deleted
}

/**
 * Bulk delete general ledger entries and recalculate running balances
 */
export async function bulkDeleteLedgerEntries(ids: string[]): Promise<{ deletedCount: number; errors: string[] }> {
  const errors: string[] = []
  let deletedCount = 0
  const affectedAccounts = new Set<string>()
  const affectedDates = new Set<number>()

  // First, collect all entries to be deleted and their account/date info
  for (const id of ids) {
    try {
      const ledgerEntry = await GeneralLedger.findById(id)
      if (!ledgerEntry) {
        errors.push(`Ledger entry ${id} not found`)
        continue
      }

      affectedAccounts.add(ledgerEntry.account_id)
      affectedDates.add(ledgerEntry.date.getTime())

      // Delete the entry
      await GeneralLedger.findByIdAndDelete(id)
      deletedCount++
    } catch (error: any) {
      errors.push(`Failed to delete ledger entry ${id}: ${error.message}`)
    }
  }

  // Recalculate running balances for all affected accounts
  for (const accountId of affectedAccounts) {
    try {
      // Use the earliest date from affected dates for this account
      const minDate = new Date(Math.min(...Array.from(affectedDates)))
      await recalculateAccountRunningBalances(accountId, minDate)
    } catch (error: any) {
      errors.push(`Failed to recalculate balances for account ${accountId}: ${error.message}`)
    }
  }

  return { deletedCount, errors }
}

/**
 * Recalculate running balances for an account starting from a specific date
 */
async function recalculateAccountRunningBalances(accountId: string, fromDate: Date): Promise<void> {
  // Get all entries for this account from the earliest date, sorted chronologically
  const entries = await GeneralLedger.find({
    account_id: accountId,
    date: { $gte: fromDate },
  })
    .sort({ date: 1, createdAt: 1 })
    .exec()

  if (entries.length === 0) return

  // Get the balance before the fromDate
  let runningBalance = 0
  const beforeEntries = await GeneralLedger.find({
    account_id: accountId,
    date: { $lt: fromDate },
  })
    .sort({ date: -1, createdAt: -1 })
    .limit(1)
    .exec()

  if (beforeEntries.length > 0) {
    runningBalance = beforeEntries[0].running_balance
  }

  // Recalculate running balances for all entries from fromDate onwards
  for (const entry of entries) {
    const accountType = entry.account_type || 'Asset'
    
    // Calculate balance change
    const balanceChange = entry.debit - entry.credit

    // Update running balance based on account type
    if (accountType === 'Asset' || accountType === 'Expense') {
      runningBalance += balanceChange
    } else {
      // Liability, Equity, Revenue: credit increases balance
      runningBalance -= balanceChange
    }

    entry.running_balance = runningBalance
    await entry.save()
  }
}

