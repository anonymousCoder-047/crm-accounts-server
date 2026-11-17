import Currency, { ICurrency } from '../models/Currency'
import { FilterQuery } from 'mongoose'

export interface CurrencyInput {
  code: string
  name: string
  symbol?: string
  isDefault?: boolean
  isActive?: boolean
}

export async function createCurrency(input: CurrencyInput): Promise<ICurrency> {
  return Currency.create(input)
}

export async function listCurrencies(activeOnly: boolean = false): Promise<ICurrency[]> {
  const filter: FilterQuery<ICurrency> = {}
  if (activeOnly) {
    filter.isActive = true
  }
  return Currency.find(filter).sort({ isDefault: -1, code: 1 })
}

export async function getCurrencyById(id: string): Promise<ICurrency | null> {
  return Currency.findById(id)
}

export async function getCurrencyByCode(code: string): Promise<ICurrency | null> {
  return Currency.findOne({ code: code.toUpperCase() })
}

export async function updateCurrency(
  id: string,
  updates: Partial<CurrencyInput>
): Promise<ICurrency | null> {
  return Currency.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
}

export async function deleteCurrency(id: string): Promise<ICurrency | null> {
  return Currency.findByIdAndDelete(id)
}

// Initialize default currencies if none exist
export async function initializeDefaultCurrencies(): Promise<void> {
  const count = await Currency.countDocuments()
  if (count === 0) {
    await Currency.insertMany([
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', isDefault: true, isActive: true },
      { code: 'USD', name: 'US Dollar', symbol: '$', isDefault: false, isActive: true },
      { code: 'EUR', name: 'Euro', symbol: '€', isDefault: false, isActive: true },
      { code: 'GBP', name: 'British Pound', symbol: '£', isDefault: false, isActive: true },
    ])
  }
}


