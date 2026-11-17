import Customer, { ICustomer } from '../models/Customer'
import { FilterQuery } from 'mongoose'

export interface CustomerInput {
  name?: string
  email?: string
  phone?: string
  trn?: string
  address?: string
}

export async function createCustomer(input: CustomerInput): Promise<ICustomer> {
  return Customer.create({
    name: input.name || '',
    email: input.email,
    phone: input.phone,
    trn: input.trn,
    address: input.address,
  })
}

export async function listCustomers(query?: { q?: string }): Promise<ICustomer[]> {
  const filter: FilterQuery<ICustomer> = {}
  if (query?.q) {
    filter.$or = [
      { name: new RegExp(query.q, 'i') },
      { email: new RegExp(query.q, 'i') },
      { phone: new RegExp(query.q, 'i') },
      { trn: new RegExp(query.q, 'i') },
    ]
  }
  return Customer.find(filter).sort({ createdAt: -1 })
}

export async function getCustomerById(id: string): Promise<ICustomer | null> {
  return Customer.findById(id)
}

export async function updateCustomer(
  id: string,
  updates: Partial<CustomerInput>
): Promise<ICustomer | null> {
  return Customer.findByIdAndUpdate(id, updates, { new: true })
}

export async function deleteCustomer(id: string): Promise<ICustomer | null> {
  return Customer.findByIdAndDelete(id)
}

