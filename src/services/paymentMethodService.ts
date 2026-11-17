import PaymentMethod, { IPaymentMethod } from '../models/PaymentMethod'
import { FilterQuery } from 'mongoose'

export interface PaymentMethodInput {
  name: string
  description?: string
  isActive?: boolean
}

export async function createPaymentMethod(input: PaymentMethodInput): Promise<IPaymentMethod> {
  return PaymentMethod.create(input)
}

export async function listPaymentMethods(activeOnly: boolean = false): Promise<IPaymentMethod[]> {
  const filter: FilterQuery<IPaymentMethod> = {}
  if (activeOnly) {
    filter.isActive = true
  }
  return PaymentMethod.find(filter).sort({ createdAt: -1 })
}

export async function getPaymentMethodById(id: string): Promise<IPaymentMethod | null> {
  return PaymentMethod.findById(id)
}

export async function updatePaymentMethod(
  id: string,
  updates: Partial<PaymentMethodInput>
): Promise<IPaymentMethod | null> {
  return PaymentMethod.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
}

export async function deletePaymentMethod(id: string): Promise<IPaymentMethod | null> {
  return PaymentMethod.findByIdAndDelete(id)
}

// Initialize default payment methods if none exist
export async function initializeDefaultPaymentMethods(): Promise<void> {
  const count = await PaymentMethod.countDocuments()
  if (count === 0) {
    await PaymentMethod.insertMany([
      { name: 'Cash', description: 'Cash payment', isActive: true },
      { name: 'Bank Transfer', description: 'Bank transfer payment', isActive: true },
      { name: 'Check', description: 'Check payment', isActive: true },
      { name: 'Credit Card', description: 'Credit card payment', isActive: true },
      { name: 'Other', description: 'Other payment method', isActive: true },
    ])
  }
}


