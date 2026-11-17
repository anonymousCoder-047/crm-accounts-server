import ExpenseType, { IExpenseType } from '../models/ExpenseType'
import { FilterQuery } from 'mongoose'

export interface ExpenseTypeInput {
  name: string
  description?: string
  recurring?: boolean
}

export async function createExpenseType(input: ExpenseTypeInput): Promise<IExpenseType> {
  return ExpenseType.create(input)
}

export async function listExpenseTypes(query?: { q?: string }): Promise<IExpenseType[]> {
  const filter: FilterQuery<IExpenseType> = {}
  if (query?.q) {
    filter.$or = [
      { name: new RegExp(query.q, 'i') },
      { description: new RegExp(query.q, 'i') },
    ]
  }
  return ExpenseType.find(filter).sort({ createdAt: -1 })
}

export async function getExpenseTypeById(id: string): Promise<IExpenseType | null> {
  return ExpenseType.findById(id)
}

export async function updateExpenseType(
  id: string,
  updates: Partial<ExpenseTypeInput>
): Promise<IExpenseType | null> {
  return ExpenseType.findByIdAndUpdate(id, updates, { new: true })
}

export async function deleteExpenseType(id: string): Promise<IExpenseType | null> {
  return ExpenseType.findByIdAndDelete(id)
}

