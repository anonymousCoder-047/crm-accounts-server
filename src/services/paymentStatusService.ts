import PaymentStatus, { IPaymentStatus } from '../models/PaymentStatus'
import { FilterQuery } from 'mongoose'

export interface PaymentStatusInput {
  name: string
  description?: string
  isActive?: boolean
}

export async function createPaymentStatus(input: PaymentStatusInput): Promise<IPaymentStatus> {
  return PaymentStatus.create(input)
}

export async function listPaymentStatuses(activeOnly: boolean = false): Promise<IPaymentStatus[]> {
  const filter: FilterQuery<IPaymentStatus> = {}
  if (activeOnly) {
    filter.isActive = true
  }
  return PaymentStatus.find(filter).sort({ createdAt: -1 })
}

export async function getPaymentStatusById(id: string): Promise<IPaymentStatus | null> {
  return PaymentStatus.findById(id)
}

export async function updatePaymentStatus(
  id: string,
  updates: Partial<PaymentStatusInput>
): Promise<IPaymentStatus | null> {
  return PaymentStatus.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
}

export async function deletePaymentStatus(id: string): Promise<IPaymentStatus | null> {
  return PaymentStatus.findByIdAndDelete(id)
}

// Initialize default payment statuses if none exist
export async function initializeDefaultPaymentStatuses(): Promise<void> {
  const count = await PaymentStatus.countDocuments()
  if (count === 0) {
    await PaymentStatus.insertMany([
      { name: 'Paid', description: 'Payment completed', isActive: true },
      { name: 'Unpaid', description: 'Payment pending', isActive: true },
      { name: 'Partial', description: 'Partial payment received', isActive: true },
      { name: 'Overdue', description: 'Payment overdue', isActive: true },
    ])
  }
}

