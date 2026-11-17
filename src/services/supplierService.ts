import Supplier, { ISupplier } from '../models/Supplier'
import { FilterQuery } from 'mongoose'

export interface SupplierInput {
  name?: string
  email?: string
  phone?: string
  address?: string
}

export async function createSupplier(input: SupplierInput): Promise<ISupplier> {
  return Supplier.create({
    name: input.name || '',
    email: input.email,
    phone: input.phone,
    address: input.address,
  })
}

export async function listSuppliers(query?: { q?: string }): Promise<ISupplier[]> {
  const filter: FilterQuery<ISupplier> = {}
  if (query?.q) {
    filter.$or = [
      { name: new RegExp(query.q, 'i') },
      { email: new RegExp(query.q, 'i') },
      { phone: new RegExp(query.q, 'i') },
      { address: new RegExp(query.q, 'i') },
      { trn: new RegExp(query.q, 'i') },
    ]
  }
  return Supplier.find(filter).sort({ createdAt: -1 })
}

export async function getSupplierById(id: string): Promise<ISupplier | null> {
  return Supplier.findById(id)
}

export async function updateSupplier(
  id: string,
  updates: Partial<SupplierInput>
): Promise<ISupplier | null> {
  return Supplier.findByIdAndUpdate(id, updates, { new: true })
}

export async function deleteSupplier(id: string): Promise<ISupplier | null> {
  return Supplier.findByIdAndDelete(id)
}


