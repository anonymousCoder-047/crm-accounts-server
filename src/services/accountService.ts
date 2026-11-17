import Account, { IAccount, AccountType, AccountSubType } from '../models/Account'
import { FilterQuery } from 'mongoose'
import { getAccountSubType } from './accountSubTypeMapper'

export interface AccountInput {
  account_name: string
  account_type: AccountType
  account_sub_type?: AccountSubType
  parent_account_id?: string
  account_code?: string
  description?: string
  is_system_account?: boolean
  is_active?: boolean
  opening_balance?: number
  currency?: string
}

export async function createAccount(input: AccountInput): Promise<IAccount> {
  // Generate account_id manually to ensure it's set before validation
  const prefix = input.account_type === 'Asset' ? 'ASSET' :
                 input.account_type === 'Liability' ? 'LIAB' :
                 input.account_type === 'Equity' ? 'EQUITY' :
                 input.account_type === 'Revenue' ? 'REV' : 'EXP'
  const account_id = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  
  // Auto-assign sub-type if not provided
  const account_sub_type = input.account_sub_type || getAccountSubType(input.account_name, input.account_type)
  
  return Account.create({
    account_id,
    account_name: input.account_name,
    account_type: input.account_type,
    account_sub_type,
    parent_account_id: input.parent_account_id,
    account_code: input.account_code,
    description: input.description,
    is_system_account: input.is_system_account || false,
    is_active: input.is_active !== undefined ? input.is_active : true,
    opening_balance: input.opening_balance || 0,
    current_balance: input.opening_balance || 0,
    currency: input.currency || 'AED',
  })
}

export async function listAccounts(query?: { 
  q?: string
  account_type?: AccountType
  account_sub_type?: AccountSubType
  is_active?: boolean
}): Promise<IAccount[]> {
  const filter: FilterQuery<IAccount> = {}
  
  if (query?.q) {
    filter.$or = [
      { account_name: new RegExp(query.q, 'i') },
      { account_code: new RegExp(query.q, 'i') },
      { account_id: new RegExp(query.q, 'i') },
      { description: new RegExp(query.q, 'i') },
    ]
  }
  
  if (query?.account_type) {
    filter.account_type = query.account_type
  }
  
  if (query?.account_sub_type) {
    filter.account_sub_type = query.account_sub_type
  }
  
  if (query?.is_active !== undefined) {
    filter.is_active = query.is_active
  }
  
  return Account.find(filter)
    .populate('parent_account_id')
    .sort({ account_type: 1, account_sub_type: 1, account_name: 1 })
}

export async function getAccountById(id: string): Promise<IAccount | null> {
  return Account.findById(id).populate('parent_account_id')
}

export async function getAccountByAccountId(accountId: string): Promise<IAccount | null> {
  return Account.findOne({ account_id: accountId }).populate('parent_account_id')
}

export async function updateAccount(
  id: string,
  updates: Partial<AccountInput>
): Promise<IAccount | null> {
  // Don't allow updating account_id directly
  const { account_id, opening_balance, ...safeUpdates } = updates as any
  
  // If opening_balance is being updated, also update current_balance
  if (opening_balance !== undefined) {
    const account = await Account.findById(id)
    if (account) {
      const balanceDiff = opening_balance - account.opening_balance
      safeUpdates.current_balance = (account.current_balance || 0) + balanceDiff
      safeUpdates.opening_balance = opening_balance
    }
  }
  
  return Account.findByIdAndUpdate(id, safeUpdates, { new: true, runValidators: true })
}

export async function deleteAccount(id: string): Promise<IAccount | null> {
  return Account.findByIdAndDelete(id)
}

export async function updateOpeningBalance(
  accountId: string,
  openingBalance: number
): Promise<IAccount | null> {
  const account = await Account.findById(accountId)
  if (!account) {
    throw new Error('Account not found')
  }
  
  const balanceDiff = openingBalance - account.opening_balance
  account.opening_balance = openingBalance
  account.current_balance = (account.current_balance || 0) + balanceDiff
  
  return account.save()
}

