import JournalEntry, { IJournalEntry, IJournalEntryLine, SourceModule } from '../models/JournalEntry'
import GeneralLedger, { IGeneralLedger } from '../models/GeneralLedger'
import { FilterQuery } from 'mongoose'
import SalesInvoice from '../models/SalesInvoice'
import PurchaseInvoice from '../models/PurchaseInvoice'
import Expense from '../models/Expense'
import Inventory from '../models/Inventory'
import Payable from '../models/Payable'
import Receivable from '../models/Receivable'

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

// Legacy entry format for backward compatibility
export interface LegacyJournalEntryLine {
  account: string
  type: 'debit' | 'credit'
  amount: number
}

export interface CreateJournalEntryInput {
  date: Date
  reference?: string
  description: string
  entries: IJournalEntryLine[] | LegacyJournalEntryLine[] // Support both formats
  createdBy: string
  source_module?: SourceModule
  attachments?: string[]
  // Legacy fields for backward compatibility
  referenceType?: 'Sales' | 'Purchase' | 'Expense' | 'Inventory' | 'Payable' | 'Receivable'
  referenceId?: string
}

/**
 * Convert legacy journal entry line format to new format
 */
function convertLegacyEntry(entry: LegacyJournalEntryLine | IJournalEntryLine): IJournalEntryLine {
  // Check if it's already in new format
  if ('account_id' in entry && 'account_name' in entry && 'debit' in entry && 'credit' in entry) {
    return entry as IJournalEntryLine
  }

  // Convert from legacy format
  const legacyEntry = entry as LegacyJournalEntryLine
  const accountId = legacyEntry.account.toUpperCase().replace(/\s+/g, '_')
  const accountName = legacyEntry.account

  return {
    account_id: accountId,
    account_name: accountName,
    debit: legacyEntry.type === 'debit' ? legacyEntry.amount : 0,
    credit: legacyEntry.type === 'credit' ? legacyEntry.amount : 0,
  }
}

export interface UpdateJournalEntryInput {
  date?: Date
  reference?: string
  description?: string
  entries?: IJournalEntryLine[]
  attachments?: string[]
}

export interface JournalEntryFilters {
  startDate?: Date
  endDate?: Date
  referenceType?: 'Sales' | 'Purchase' | 'Expense' | 'Inventory' | 'Payable' | 'Receivable'
  source_module?: SourceModule
  account?: string
  account_id?: string
}

/**
 * Determine account type based on account name/ID
 * This is a helper function - in a full system, you'd rely on ChartOfAccount
 */
function getAccountType(accountId: string, accountName?: string): AccountType {
  const id = accountId.toLowerCase()
  const name = (accountName || '').toLowerCase()

  // Assets
  if (
    id.includes('cash') ||
    id.includes('bank') ||
    id.includes('ar') ||
    id.includes('receivable') ||
    id.includes('inventory') ||
    id.includes('asset') ||
    name.includes('cash') ||
    name.includes('bank') ||
    name.includes('receivable') ||
    name.includes('inventory') ||
    name.includes('asset')
  ) {
    return 'Asset'
  }

  // Liabilities
  if (
    id.includes('ap') ||
    id.includes('payable') ||
    id.includes('liability') ||
    name.includes('payable') ||
    name.includes('liability')
  ) {
    return 'Liability'
  }

  // Revenue
  if (
    id.includes('revenue') ||
    id.includes('sales') ||
    id.includes('income') ||
    name.includes('revenue') ||
    name.includes('sales') ||
    name.includes('income')
  ) {
    return 'Revenue'
  }

  // Expenses
  if (
    id.includes('expense') ||
    id.includes('cogs') ||
    id.includes('cost') ||
    name.includes('expense') ||
    name.includes('cost')
  ) {
    return 'Expense'
  }

  // Default to Asset if uncertain
  return 'Asset'
}

/**
 * Calculate running balance for an account
 * Assets & Expenses: increase on debit, decrease on credit
 * Liabilities, Equity, Revenue: increase on credit, decrease on debit
 */
function calculateRunningBalance(
  accountType: AccountType,
  previousBalance: number,
  debit: number,
  credit: number
): number {
  if (accountType === 'Asset' || accountType === 'Expense') {
    // Assets and Expenses: Debit increases, Credit decreases
    return previousBalance + debit - credit
  } else {
    // Liabilities, Equity, Revenue: Credit increases, Debit decreases
    return previousBalance + credit - debit
  }
}

/**
 * Get the last running balance for an account before a given date
 */
async function getLastRunningBalance(accountId: string, beforeDate: Date): Promise<number> {
  const lastEntry = await GeneralLedger.findOne({
    account_id: accountId,
    date: { $lt: beforeDate },
  })
    .sort({ date: -1, createdAt: -1 })
    .exec()

  return lastEntry?.running_balance || 0
}

/**
 * Recalculate running balances for an account from a given date forward
 */
async function recalculateRunningBalances(accountId: string, fromDate: Date): Promise<void> {
  const entries = await GeneralLedger.find({
    account_id: accountId,
    date: { $gte: fromDate },
  })
    .sort({ date: 1, createdAt: 1 })
    .exec()

  if (entries.length === 0) return

  // Get the balance before the first entry
  const previousBalance = await getLastRunningBalance(accountId, fromDate)
  const accountType = entries[0].account_type || getAccountType(accountId, entries[0].account_name)

  let runningBalance = previousBalance

  // Recalculate each entry's running balance
  for (const entry of entries) {
    runningBalance = calculateRunningBalance(
      accountType,
      runningBalance,
      entry.debit,
      entry.credit
    )
    entry.running_balance = runningBalance
    await entry.save()
  }
}

/**
 * Generate a unique ledger_id
 * Uses timestamp + random string to avoid race conditions
 */
async function generateUniqueLedgerId(): Promise<string> {
  let attempts = 0
  const maxAttempts = 10
  
  while (attempts < maxAttempts) {
    // Use timestamp (last 8 digits) + random string for uniqueness
    const timestamp = Date.now().toString().slice(-8)
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    const ledgerId = `GL-${timestamp}-${random}`
    
    // Check if this ID already exists
    const exists = await GeneralLedger.findOne({ ledger_id: ledgerId }).exec()
    if (!exists) {
      return ledgerId
    }
    
    attempts++
    // Small delay before retry
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  
  // Fallback: use ObjectId if all attempts fail
  const mongoose = await import('mongoose')
  return `GL-${new mongoose.Types.ObjectId().toString()}`
}

/**
 * Create ledger entries from a journal entry
 */
export async function createLedgerEntries(journalEntry: IJournalEntry): Promise<void> {
  const ledgerEntries: IGeneralLedger[] = []
  
  // Look up account sub-types for all accounts in this journal entry
  const accountIds = journalEntry.lines.map(e => e.account_id)
  const Account = (await import('../models/Account')).default
  const accounts = await Account.find({ account_id: { $in: accountIds } })
    .select('account_id account_type account_sub_type')
    .lean()
  
  const accountSubTypeMap = new Map<string, { account_type: string; account_sub_type?: string }>()
  for (const acc of accounts) {
    accountSubTypeMap.set(acc.account_id, {
      account_type: acc.account_type,
      account_sub_type: acc.account_sub_type,
    })
  }
  
  for (let i = 0; i < journalEntry.lines.length; i++) {
    const entry = journalEntry.lines[i]
    
    // Get account type and sub-type from Account model, fallback to getAccountType
    const accountInfo = accountSubTypeMap.get(entry.account_id)
    const accountType = accountInfo?.account_type as AccountType || getAccountType(entry.account_id, entry.account_name)
    const accountSubType = accountInfo?.account_sub_type
    
    // Get the last running balance for this account before this entry's date
    const previousBalance = await getLastRunningBalance(entry.account_id, journalEntry.date)
    
    // Calculate new running balance
    const runningBalance = calculateRunningBalance(
      accountType,
      previousBalance,
      entry.debit,
      entry.credit
    )

    // Generate unique ledger_id for this entry
    const ledgerId = await generateUniqueLedgerId()

    const ledgerEntry = new GeneralLedger({
      ledger_id: ledgerId,
      account_id: entry.account_id,
      account_name: entry.account_name || entry.account_id,
      account_type: accountType,
      account_sub_type: accountSubType,
      date: journalEntry.date,
      debit: entry.debit,
      credit: entry.credit,
      running_balance: runningBalance,
      journal_reference: journalEntry._id,
      journal_id: journalEntry.journal_id,
      source_module: journalEntry.source_module,
      description: journalEntry.description,
      reference: journalEntry.reference,
    })

    ledgerEntries.push(ledgerEntry)
  }

  // Save all ledger entries with error handling for duplicates
  try {
    await GeneralLedger.insertMany(ledgerEntries, { ordered: false })
  } catch (error: any) {
    // If duplicate key error occurs, retry with new IDs
    if (error.code === 11000) {
      console.warn('Duplicate ledger_id detected, regenerating IDs and retrying...')
      
      // Regenerate IDs for all entries
      for (const ledgerEntry of ledgerEntries) {
        ledgerEntry.ledger_id = await generateUniqueLedgerId()
      }
      
      // Retry insert
      await GeneralLedger.insertMany(ledgerEntries, { ordered: false })
    } else {
      throw error
    }
  }

  // Recalculate running balances for all affected accounts from this date forward
  // This ensures consistency if there are multiple entries on the same date
  const uniqueAccountIds = new Set<string>(journalEntry.lines.map(e => e.account_id))
  for (const accountId of uniqueAccountIds.values()) {
    await recalculateRunningBalances(accountId, journalEntry.date)
  }
}

/**
 * Validate that the referenced document exists (for legacy support)
 * Handles payment entries which may have composite referenceIds (e.g., "receivableId-PAY-timestamp-amount")
 */
async function validateReference(
  referenceType: string,
  referenceId: string
): Promise<boolean> {
  try {
    // Extract the base ID for payment entries (format: "baseId-PAY-timestamp-amount" or "baseId-PAYABLE-timestamp-amount")
    let baseId = referenceId
    if (referenceId.includes('-PAY-') || referenceId.includes('-PAYABLE-')) {
      // Extract the base ID (everything before "-PAY-" or "-PAYABLE-")
      baseId = referenceId.split('-PAY')[0]
    }
    
    switch (referenceType) {
      case 'Sales':
        const salesInvoice = await SalesInvoice.findById(baseId)
        return !!salesInvoice
      case 'Purchase':
        const purchaseInvoice = await PurchaseInvoice.findById(baseId)
        return !!purchaseInvoice
      case 'Expense':
        const expense = await Expense.findById(baseId)
        return !!expense
      case 'Inventory':
        const inventory = await Inventory.findById(baseId)
        return !!inventory
      case 'Payable':
        const payable = await Payable.findById(baseId)
        return !!payable
      case 'Receivable':
        const receivable = await Receivable.findById(baseId)
        return !!receivable
      default:
        return false
    }
  } catch (error) {
    return false
  }
}

/**
 * Create a new journal entry and automatically create ledger entries
 */
export async function createJournalEntry(
  input: CreateJournalEntryInput
): Promise<IJournalEntry> {
  // Validate reference integrity if legacy fields are provided
  if (input.referenceType && input.referenceId) {
    const referenceExists = await validateReference(input.referenceType, input.referenceId)
    if (!referenceExists) {
      throw new Error(`Referenced ${input.referenceType} document not found`)
    }

    // Check for duplicate journal entries with same reference and referenceId
    // This prevents creating duplicate entries for the same transaction
    // For payment entries (receivable_payment, payable_payment), also check reference field
    // because multiple payments can be made to the same receivable/payable
    const duplicateQuery: any = {
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      source_module: input.source_module || 'manual',
      // Check within last 5 minutes to catch rapid duplicate calls
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    }
    
    // For payment entries, also check reference field to distinguish between different payments
    if (input.source_module === 'receivable_payment' || input.source_module === 'payable_payment') {
      duplicateQuery.reference = input.reference
    }
    
    const existingEntry = await JournalEntry.findOne(duplicateQuery)

    if (existingEntry) {
      // Verify the existing entry is valid (has lines and is complete)
      if (existingEntry.lines && existingEntry.lines.length > 0) {
        console.warn(`Duplicate journal entry detected for ${input.referenceType} ${input.referenceId}. Returning existing entry (ID: ${existingEntry._id}).`)
        return existingEntry.populate('createdBy', 'name email') as Promise<IJournalEntry>
      } else {
        // Existing entry is incomplete, log and continue to create new one
        console.warn(`Incomplete journal entry found for ${input.referenceType} ${input.referenceId}. Creating new entry.`)
      }
    }
  }

  // Convert entries to new format if needed
  const convertedEntries = input.entries.map(convertLegacyEntry)

  // Create journal entry (validation happens in pre-save hook)
  const journalEntry = new JournalEntry({
    date: input.date,
    reference: input.reference,
    description: input.description,
    lines: convertedEntries,
    createdBy: input.createdBy,
    source_module: input.source_module || 'manual',
    attachments: input.attachments || [],
    // Legacy fields
    referenceType: input.referenceType,
    referenceId: input.referenceId,
  })

  const savedEntry = await journalEntry.save()

  // Create ledger entries
  await createLedgerEntries(savedEntry)

  return savedEntry.populate('createdBy', 'name email')
}

/**
 * Update a journal entry and regenerate ledger entries
 */
export async function updateJournalEntry(
  id: string,
  input: UpdateJournalEntryInput
): Promise<IJournalEntry | null> {
  const journalEntry = await JournalEntry.findById(id)
  if (!journalEntry) {
    return null
  }

  // Delete existing ledger entries for this journal entry
  await GeneralLedger.deleteMany({ journal_reference: journalEntry._id })

  // Update journal entry
  if (input.date !== undefined) journalEntry.date = input.date
  if (input.reference !== undefined) journalEntry.reference = input.reference
  if (input.description !== undefined) journalEntry.description = input.description
  if (input.entries !== undefined) journalEntry.lines = input.entries
  if (input.attachments !== undefined) journalEntry.attachments = input.attachments

  const savedEntry = await journalEntry.save()

  // Recreate ledger entries
  await createLedgerEntries(savedEntry)

  // Recalculate running balances for all affected accounts
  const accountIds = new Set<string>(savedEntry.lines.map(e => e.account_id))
  for (const accountId of accountIds.values()) {
    await recalculateRunningBalances(accountId, savedEntry.date)
  }

  return savedEntry.populate('createdBy', 'name email')
}

/**
 * List journal entries with filters
 */
export async function listJournalEntries(
  filters: JournalEntryFilters = {},
  userId?: string
): Promise<IJournalEntry[]> {
  const query: FilterQuery<IJournalEntry> = {}

  if (filters.startDate || filters.endDate) {
    query.date = {}
    if (filters.startDate) {
      query.date.$gte = filters.startDate
    }
    if (filters.endDate) {
      query.date.$lte = filters.endDate
    }
  }

  if (filters.referenceType) {
    query.referenceType = filters.referenceType
  }

  if (filters.source_module) {
    query.source_module = filters.source_module
  }

  if (filters.account) {
    query['lines.account_name'] = filters.account
  }

  if (filters.account_id) {
    query['lines.account_id'] = filters.account_id
  }

  return JournalEntry.find(query)
    .populate('createdBy', 'name email')
    .sort({ date: -1, createdAt: -1 })
    .exec()
}

/**
 * Get journal entry by ID
 */
export async function getJournalEntryById(id: string): Promise<IJournalEntry | null> {
  return JournalEntry.findById(id).populate('createdBy', 'name email').exec()
}

/**
 * Get journal entries by reference (legacy support)
 */
export async function getJournalEntriesByReference(
  referenceType: 'Sales' | 'Purchase' | 'Expense' | 'Inventory' | 'Payable' | 'Receivable',
  referenceId: string
): Promise<IJournalEntry[]> {
  // Ensure referenceId is a valid ObjectId string, not a stringified object
  let validReferenceId: any = referenceId
  
  // If referenceId looks like a stringified object, try to extract the _id
  if (typeof referenceId === 'string') {
    // First, check if it's already a valid 24-character hex string
    const mongoose = await import('mongoose')
    if (mongoose.Types.ObjectId.isValid(referenceId) && referenceId.length === 24 && /^[a-fA-F0-9]{24}$/.test(referenceId)) {
      // It's already a valid ObjectId string, use it directly
      validReferenceId = new mongoose.Types.ObjectId(referenceId)
    } else if (referenceId.length > 50 || referenceId.includes('ObjectId') || referenceId.includes('_id:')) {
      // If it's a very long string or contains ObjectId patterns, it might be a stringified object
      // Try multiple patterns to extract the _id
      
      // Pattern 1: _id: new ObjectId('...')
      let idMatch = referenceId.match(/_id:\s*(?:new\s+)?ObjectId\(['"]([a-fA-F0-9]{24})['"]\)/)
      if (idMatch && idMatch[1]) {
        validReferenceId = idMatch[1]
      } else {
        // Pattern 2: ObjectId('...')
        idMatch = referenceId.match(/ObjectId\(['"]([a-fA-F0-9]{24})['"]\)/)
        if (idMatch && idMatch[1]) {
          validReferenceId = idMatch[1]
        } else {
          // Pattern 3: Find first 24-character hex string
          idMatch = referenceId.match(/([a-fA-F0-9]{24})/)
          if (idMatch && idMatch[1]) {
            validReferenceId = idMatch[1]
          }
        }
      }
      
      // Validate the extracted ID
      if (typeof validReferenceId === 'string') {
        if (mongoose.Types.ObjectId.isValid(validReferenceId) && validReferenceId.length === 24) {
          validReferenceId = new mongoose.Types.ObjectId(validReferenceId)
        } else {
          // If invalid, return empty array instead of throwing error
          console.warn(`Invalid referenceId format after extraction: ${referenceId.substring(0, 100)}`)
          return []
        }
      } else {
        // If we couldn't extract a valid ID, return empty array
        console.warn(`Could not extract valid ObjectId from: ${referenceId.substring(0, 100)}`)
        return []
      }
    } else {
      // If it's a short string but not a valid ObjectId, return empty array
      console.warn(`Invalid referenceId format (too short or invalid): ${referenceId}`)
      return []
    }
  }
  
  return JournalEntry.find({
    referenceType,
    referenceId: validReferenceId,
  })
    .populate('createdBy', 'name email')
    .sort({ date: -1, createdAt: -1 })
    .exec()
}

/**
 * Delete journal entry and remove associated ledger entries
 */
export async function deleteJournalEntry(id: string): Promise<IJournalEntry | null> {
  const journalEntry = await JournalEntry.findById(id)
  if (!journalEntry) {
    return null
  }

  // Delete associated ledger entries
  await GeneralLedger.deleteMany({ journal_reference: journalEntry._id })

  // Recalculate running balances for affected accounts
  const accountIds = new Set<string>(journalEntry.lines.map(e => e.account_id))
  for (const accountId of accountIds.values()) {
    await recalculateRunningBalances(accountId, journalEntry.date)
  }

  // Delete journal entry
  return JournalEntry.findByIdAndDelete(id)
}

/**
 * Bulk delete journal entries and remove associated ledger entries
 */
export async function bulkDeleteJournalEntries(ids: string[]): Promise<{ deletedCount: number; errors: string[] }> {
  const errors: string[] = []
  let deletedCount = 0

  for (const id of ids) {
    try {
      const journalEntry = await JournalEntry.findById(id)
      if (!journalEntry) {
        errors.push(`Journal entry ${id} not found`)
        continue
      }

      // Delete associated ledger entries
      await GeneralLedger.deleteMany({ journal_reference: journalEntry._id })

      // Collect affected accounts for balance recalculation
      const accountIds = new Set<string>(journalEntry.lines.map(e => e.account_id))
      
      // Delete journal entry
      await JournalEntry.findByIdAndDelete(id)
      deletedCount++

      // Recalculate running balances for affected accounts
      for (const accountId of accountIds.values()) {
        await recalculateRunningBalances(accountId, journalEntry.date)
      }
    } catch (error: any) {
      errors.push(`Failed to delete journal entry ${id}: ${error.message}`)
    }
  }

  return { deletedCount, errors }
}

/**
 * Regenerate ledger from all journal entries
 * Useful for fixing data inconsistencies or after migration
 */
export async function regenerateLedgerFromJournals(): Promise<{ success: boolean; message: string }> {
  try {
    // Delete all existing ledger entries
    await GeneralLedger.deleteMany({})

    // Get all journal entries sorted by date
    const journalEntries = await JournalEntry.find({})
      .sort({ date: 1, createdAt: 1 })
      .exec()

    // Recreate ledger entries
    for (const journalEntry of journalEntries) {
      await createLedgerEntries(journalEntry)
    }

    return {
      success: true,
      message: `Regenerated ledger from ${journalEntries.length} journal entries`,
    }
  } catch (error: any) {
    throw new Error(`Failed to regenerate ledger: ${error.message}`)
  }
}

/**
 * Find and remove duplicate journal entries
 * Duplicates are identified by: same reference, same date, same total debit/credit amounts
 */
export async function findAndRemoveDuplicateJournalEntries(): Promise<{ duplicatesFound: number; duplicatesRemoved: number; errors: string[] }> {
  const errors: string[] = []
  let duplicatesFound = 0
  let duplicatesRemoved = 0

  try {
    // Get all journal entries grouped by reference and date
    const allEntries = await JournalEntry.find({})
      .sort({ date: 1, createdAt: 1 })
      .exec()

    // Group entries by reference, date, and total amounts
    const entryGroups = new Map<string, IJournalEntry[]>()
    
    for (const entry of allEntries) {
      // Calculate total debit and credit for this entry
      const totalDebit = entry.lines.reduce((sum, line) => sum + (line.debit || 0), 0)
      const totalCredit = entry.lines.reduce((sum, line) => sum + (line.credit || 0), 0)
      
      // Create a unique key: reference + date + totalDebit + totalCredit + source_module
      const key = `${entry.reference || 'NO_REF'}_${entry.date.toISOString()}_${totalDebit}_${totalCredit}_${entry.source_module || 'manual'}`
      
      if (!entryGroups.has(key)) {
        entryGroups.set(key, [])
      }
      entryGroups.get(key)!.push(entry)
    }

    // Find groups with more than one entry (duplicates)
    for (const [key, entries] of entryGroups.entries()) {
      if (entries.length > 1) {
        duplicatesFound += entries.length - 1 // All except the first one are duplicates
        
        // Keep the first entry (oldest), delete the rest
        const entriesToDelete = entries.slice(1)
        
        for (const duplicateEntry of entriesToDelete) {
          try {
            await deleteJournalEntry(String(duplicateEntry._id))
            duplicatesRemoved++
          } catch (error: any) {
            errors.push(`Failed to delete duplicate journal entry ${duplicateEntry._id}: ${error.message}`)
          }
        }
      }
    }

    return { duplicatesFound, duplicatesRemoved, errors }
  } catch (error: any) {
    errors.push(`Error finding duplicates: ${error.message}`)
    return { duplicatesFound, duplicatesRemoved, errors }
  }
}
