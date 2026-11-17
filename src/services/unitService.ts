import Unit, { IUnit } from '../models/Unit'
import { FilterQuery } from 'mongoose'

export interface UnitInput {
  name?: string
  symbol?: string
  description?: string
}

export async function createUnit(input: UnitInput): Promise<IUnit> {
  return Unit.create({
    name: input.name || '',
    symbol: input.symbol,
    description: input.description,
  })
}

export async function listUnits(query?: { q?: string }): Promise<IUnit[]> {
  const filter: FilterQuery<IUnit> = {}
  if (query?.q) {
    filter.$or = [
      { name: new RegExp(query.q, 'i') },
      { symbol: new RegExp(query.q, 'i') },
      { description: new RegExp(query.q, 'i') },
    ]
  }
  return Unit.find(filter).sort({ createdAt: -1 })
}

export async function getUnitById(id: string): Promise<IUnit | null> {
  return Unit.findById(id)
}

export async function updateUnit(
  id: string,
  updates: Partial<UnitInput>
): Promise<IUnit | null> {
  return Unit.findByIdAndUpdate(id, updates, { new: true })
}

export async function deleteUnit(id: string): Promise<IUnit | null> {
  return Unit.findByIdAndDelete(id)
}

