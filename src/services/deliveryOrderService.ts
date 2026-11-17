import DeliveryOrder, { IDeliveryOrder } from '../models/DeliveryOrder'
import { FilterQuery } from 'mongoose'

export interface DeliveryOrderInput {
  serialNumber: string
  invoiceNumber: string // ObjectId as string
  date: Date
  customer: string // ObjectId as string
  deliveryAddress?: string
  lineItems: Array<{
    product: string // ObjectId as string
    qty: number
    delivered: boolean
  }>
  attachments?: string[]
  attachment?: string // Legacy support
}

export async function createDeliveryOrder(input: DeliveryOrderInput): Promise<IDeliveryOrder> {
  return DeliveryOrder.create(input as any)
}

export async function listDeliveryOrders(query?: {
  q?: string
  invoiceNumber?: string
  customer?: string
  from?: string
  to?: string
}): Promise<IDeliveryOrder[]> {
  const filter: FilterQuery<IDeliveryOrder> = {}
  
  if (query?.q) {
    filter.$or = [
      { serialNumber: new RegExp(query.q, 'i') },
      { deliveryAddress: new RegExp(query.q, 'i') },
    ]
  }
  
  if (query?.invoiceNumber) {
    filter.invoiceNumber = query.invoiceNumber
  }
  
  if (query?.customer) {
    filter.customer = query.customer
  }
  
  if (query?.from || query?.to) {
    filter.date = {}
    if (query.from) (filter.date as any).$gte = new Date(query.from)
    if (query.to) (filter.date as any).$lte = new Date(query.to)
  }
  
  return DeliveryOrder.find(filter)
    .populate('invoiceNumber', 'invoice_number invoiceNumber serialNumber date')
    .populate('customer', 'name email phone address')
    .populate('lineItems.product', 'name serialNumber')
    .sort({ date: -1, createdAt: -1 })
}

export async function getDeliveryOrderById(id: string): Promise<IDeliveryOrder | null> {
  return DeliveryOrder.findById(id)
    .populate('invoiceNumber', 'invoice_number invoiceNumber serialNumber date')
    .populate('customer', 'name email phone address')
    .populate('lineItems.product', 'name serialNumber')
}

export async function updateDeliveryOrder(
  id: string,
  updates: Partial<DeliveryOrderInput>
): Promise<IDeliveryOrder | null> {
  return DeliveryOrder.findByIdAndUpdate(id, updates as any, { new: true, runValidators: true })
    .populate('invoiceNumber', 'invoice_number invoiceNumber serialNumber date')
    .populate('customer', 'name email phone address')
    .populate('lineItems.product', 'name serialNumber')
}

export async function deleteDeliveryOrder(id: string): Promise<IDeliveryOrder | null> {
  return DeliveryOrder.findByIdAndDelete(id)
}

// Check if any delivery orders exist for a sales invoice
export async function hasDeliveryOrdersForInvoice(invoiceId: string): Promise<boolean> {
  const count = await DeliveryOrder.countDocuments({ invoiceNumber: invoiceId })
  return count > 0
}

