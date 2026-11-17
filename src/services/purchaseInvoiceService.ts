import PurchaseInvoice, { IPurchaseInvoice } from '../models/PurchaseInvoice'
import { FilterQuery } from 'mongoose'

export interface PurchaseInvoiceInput {
  invoice_number: string
  vendor_id: string
  invoice_date: Date
  due_date: Date
  line_items: Array<{
    product: string
    description?: string
    quantity: number
    unit_cost: number
    total: number
    discount?: number
    vat?: number
  }>
  subtotal: number
  tax_amount: number
  discount: number
  total_amount: number
  currency: string
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  balance_due: number
  payment_terms?: string
  notes?: string
  payment_method?: string
  reference_number?: string
  trn?: string
}

export async function createPurchaseInvoice(
  input: PurchaseInvoiceInput,
  userId?: string
): Promise<IPurchaseInvoice> {
  // Ensure dates are Date objects
  const invoiceData: any = {
    ...input,
    invoice_date: input.invoice_date ? new Date(input.invoice_date) : new Date(),
    due_date: input.due_date ? new Date(input.due_date) : new Date(),
    // Default payment_status to 'unpaid' if not provided
    payment_status: input.payment_status || 'unpaid',
  }
  
  return PurchaseInvoice.create(invoiceData)
}

export async function listPurchaseInvoices(query?: {
  q?: string
  vendor_id?: string
  payment_status?: string
  from?: string
  to?: string
}): Promise<IPurchaseInvoice[]> {
  const filter: FilterQuery<IPurchaseInvoice> = {}
  
  if (query?.q) {
    filter.$or = [
      { invoice_number: new RegExp(query.q, 'i') },
      { notes: new RegExp(query.q, 'i') },
    ]
  }
  
  if (query?.vendor_id) {
    filter.vendor_id = query.vendor_id as any
  }
  
  if (query?.payment_status) {
    filter.payment_status = query.payment_status
  }
  
  if (query?.from || query?.to) {
    filter.invoice_date = {}
    if (query.from) (filter.invoice_date as any).$gte = new Date(query.from)
    if (query.to) (filter.invoice_date as any).$lte = new Date(query.to)
  }

  return PurchaseInvoice.find(filter)
    .populate('vendor_id')
    .populate('line_items.product')
    .populate('payable_id')
    .sort({ invoice_date: -1, createdAt: -1 })
}

export async function getPurchaseInvoiceById(id: string): Promise<IPurchaseInvoice | null> {
  return PurchaseInvoice.findById(id)
    .populate('vendor_id')
    .populate('line_items.product')
    .populate('payable_id')
}

export async function updatePurchaseInvoice(
  id: string,
  updates: Partial<PurchaseInvoiceInput>
): Promise<IPurchaseInvoice | null> {
  // Clean line_items to remove _id fields that might come from frontend
  if (updates.line_items) {
    updates.line_items = updates.line_items.map((item: any) => {
      const cleaned: any = {
        product: item.product,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total: item.total || (item.quantity * item.unit_cost),
      }
      if (item.description !== undefined) cleaned.description = item.description
      if (item.discount !== undefined) cleaned.discount = item.discount
      if (item.vat !== undefined) cleaned.vat = item.vat
      return cleaned
    })
  }
  return PurchaseInvoice.findByIdAndUpdate(id, updates as any, { new: true, runValidators: true })
}

export async function updatePaymentStatus(
  id: string,
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue'
): Promise<IPurchaseInvoice | null> {
  // Normalize payment status to lowercase for case-insensitive comparison
  const normalizedStatus = payment_status?.toLowerCase() || 'unpaid'
  const isPaid = normalizedStatus === 'paid'
  const normalizedPaymentStatus = isPaid ? 'paid' : (normalizedStatus === 'partial' ? 'partial' : normalizedStatus === 'overdue' ? 'overdue' : 'unpaid')
  const invoice = await PurchaseInvoice.findById(id)
  const balance_due = isPaid ? 0 : (invoice?.balance_due || 0)
  
  return PurchaseInvoice.findByIdAndUpdate(
    id, 
    { payment_status: normalizedPaymentStatus, balance_due }, 
    { new: true, runValidators: true }
  )
}

export async function deletePurchaseInvoice(id: string): Promise<IPurchaseInvoice | null> {
  return PurchaseInvoice.findByIdAndDelete(id)
}


