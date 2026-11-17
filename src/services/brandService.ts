import Brand, { IBrand } from '../models/Brand'
import { FilterQuery } from 'mongoose'

export interface BrandInput {
  name?: string
  description?: string
}

export async function createBrand(input: BrandInput): Promise<IBrand> {
  return Brand.create({
    name: input.name || '',
    description: input.description,
  })
}

export async function listBrands(query?: { q?: string }): Promise<IBrand[]> {
  const filter: FilterQuery<IBrand> = {}
  if (query?.q) {
    filter.$or = [
      { name: new RegExp(query.q, 'i') },
      { description: new RegExp(query.q, 'i') },
    ]
  }
  return Brand.find(filter).sort({ createdAt: -1 })
}

export async function getBrandById(id: string): Promise<IBrand | null> {
  return Brand.findById(id)
}

export async function updateBrand(
  id: string,
  updates: Partial<BrandInput>
): Promise<IBrand | null> {
  return Brand.findByIdAndUpdate(id, updates, { new: true })
}

export async function deleteBrand(id: string): Promise<IBrand | null> {
  return Brand.findByIdAndDelete(id)
}


