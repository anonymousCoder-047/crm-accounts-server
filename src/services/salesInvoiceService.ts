import SalesInvoice, { ISalesInvoice } from '../models/SalesInvoice'
import Settings from '../models/Settings'
import { FilterQuery } from 'mongoose'

export interface SalesInvoiceLineItemInput {
  product: string
  description?: string
  quantity: number
  unit_price: number
  discount?: number
  vat?: number
}

export interface SalesInvoiceInput {
  invoice_number: string
  customer_id: string
  invoice_date: Date | string
  due_date: Date | string
  line_items: SalesInvoiceLineItemInput[]
  subtotal?: number
  discount?: number
  tax_amount?: number
  total_amount?: number
  currency?: string
  payment_status?: 'unpaid' | 'partial' | 'paid' | 'overdue'
  payment_terms?: string
  notes?: string
  payment_method?: string
  reference_number?: string
  trn?: string
  isExportInvoice?: boolean
}

/**
 * Calculate line item total
 */
function calculateLineItemTotal(item: SalesInvoiceLineItemInput): number {
  const lineTotal = item.quantity * item.unit_price
  const discountAmount = item.discount || 0
  const vatAmount = item.vat || 0
  return lineTotal - discountAmount + vatAmount
}

/**
 * Calculate invoice totals
 */
export function calculateInvoiceTotals(
  lineItems: SalesInvoiceLineItemInput[],
  invoiceDiscount: number = 0,
  isExportInvoice: boolean = false
): {
  subtotal: number
  tax_amount: number
  discount: number
  total_amount: number
} {
  // Calculate subtotal from line items
  let subtotal = 0
  const lineItemsWithTotals = lineItems.map((item) => {
    const lineTotal = item.quantity * item.unit_price
    const lineDiscount = item.discount || 0
    const lineVat = isExportInvoice ? 0 : (item.vat || 0)
    const total = lineTotal - lineDiscount + lineVat
    subtotal += total
    return {
      ...item,
      total,
    }
  })

  // Apply invoice-level discount
  const discount = invoiceDiscount || 0
  const subtotalAfterDiscount = Math.max(0, subtotal - discount)

  // Calculate tax (if not export invoice, apply VAT on subtotal after discount)
  const tax_amount = isExportInvoice ? 0 : subtotalAfterDiscount * 0.05 // 5% VAT

  // Total amount
  const total_amount = subtotalAfterDiscount + tax_amount

  return {
    subtotal,
    tax_amount,
    discount,
    total_amount,
  }
}

export async function createSalesInvoice(
  input: SalesInvoiceInput,
  userId?: string
): Promise<ISalesInvoice> {
  // Get TRN from settings if not provided
  let trn = input.trn
  if (!trn) {
    const appSettings = await Settings.findOne({})
    if (appSettings?.taxInformation?.trn) {
      trn = appSettings.taxInformation.trn
    }
  }

  // Calculate totals
  const totals = calculateInvoiceTotals(
    input.line_items,
    input.discount || 0,
    input.isExportInvoice || false
  )

  // Prepare line items with calculated totals
  const lineItems = input.line_items.map((item) => {
    const lineTotal = item.quantity * item.unit_price
    const lineDiscount = item.discount || 0
    const lineVat = input.isExportInvoice ? 0 : (item.vat || 0)
    return {
      product: item.product,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: lineTotal - lineDiscount + lineVat,
      discount: lineDiscount,
      vat: lineVat,
    }
  })

  // Determine initial balance_due and payment_status - normalize to lowercase for case-insensitive comparison
  const normalizedPaymentStatus = input.payment_status?.toLowerCase() || 'unpaid'
  const isPaid = normalizedPaymentStatus === 'paid'
  const balance_due = isPaid ? 0 : totals.total_amount
  // Normalize payment_status to lowercase 'paid' if it matches
  const paymentStatus = isPaid ? 'paid' : (normalizedPaymentStatus === 'partial' ? 'partial' : normalizedPaymentStatus === 'overdue' ? 'overdue' : 'unpaid')

  const invoice = await SalesInvoice.create({
    invoice_number: input.invoice_number,
    customer_id: input.customer_id,
    invoice_date: new Date(input.invoice_date),
    due_date: new Date(input.due_date),
    line_items: lineItems,
    subtotal: totals.subtotal,
    tax_amount: totals.tax_amount,
    discount: totals.discount,
    total_amount: totals.total_amount,
    currency: input.currency || 'AED',
    payment_status: paymentStatus,
    balance_due,
    payment_terms: input.payment_terms,
    notes: input.notes,
    payment_method: input.payment_method,
    reference_number: input.reference_number,
    trn,
    isExportInvoice: input.isExportInvoice || false,
  })

  return invoice
}

export async function listSalesInvoices(query?: {
  q?: string
  customer_id?: string
  payment_status?: string
  from?: string
  to?: string
}): Promise<ISalesInvoice[]> {
  const filter: FilterQuery<ISalesInvoice> = {}
  
  if (query?.q) {
    filter.$or = [
      { invoice_number: new RegExp(query.q, 'i') },
      { notes: new RegExp(query.q, 'i') },
    ]
  }
  
  if (query?.customer_id) {
    filter.customer_id = query.customer_id as any
  }
  
  if (query?.payment_status) {
    filter.payment_status = query.payment_status
  }
  
  if (query?.from || query?.to) {
    filter.invoice_date = {}
    if (query.from) (filter.invoice_date as any).$gte = new Date(query.from)
    if (query.to) (filter.invoice_date as any).$lte = new Date(query.to)
  }

  return SalesInvoice.find(filter)
    .populate('customer_id')
    .populate('line_items.product')
    .populate('receivable_id')
    .sort({ invoice_date: -1, createdAt: -1 })
}

export async function getSalesInvoiceById(id: string): Promise<ISalesInvoice | null> {
  return SalesInvoice.findById(id)
    .populate('customer_id')
    .populate('line_items.product')
    .populate('receivable_id')
}

export async function updateSalesInvoice(
  id: string,
  updates: Partial<SalesInvoiceInput>
): Promise<ISalesInvoice | null> {
  const invoice = await SalesInvoice.findById(id)
  if (!invoice) return null

  // If line items are updated, recalculate totals
  if (updates.line_items) {
    const totals = calculateInvoiceTotals(
      updates.line_items,
      updates.discount || invoice.discount || 0,
      updates.isExportInvoice !== undefined ? updates.isExportInvoice : invoice.isExportInvoice || false
    )

    // Prepare line items with calculated totals
    const lineItems = updates.line_items.map((item) => {
      const lineTotal = item.quantity * item.unit_price
      const lineDiscount = item.discount || 0
      const lineVat = (updates.isExportInvoice !== undefined ? updates.isExportInvoice : invoice.isExportInvoice || false) ? 0 : (item.vat || 0)
      return {
        product: item.product,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: lineTotal - lineDiscount + lineVat,
        discount: lineDiscount,
        vat: lineVat,
      }
    })

    updates.subtotal = totals.subtotal
    updates.tax_amount = totals.tax_amount
    updates.discount = totals.discount
    updates.total_amount = totals.total_amount
    ;(updates as any).line_items = lineItems
  }

  return SalesInvoice.findByIdAndUpdate(id, updates as any, { new: true, runValidators: true })
}

export async function updatePaymentStatus(
  id: string,
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue'
): Promise<ISalesInvoice | null> {
  const invoice = await SalesInvoice.findById(id)
  if (!invoice) return null

  // Normalize payment status to lowercase for case-insensitive comparison
  const normalizedStatus = payment_status?.toLowerCase() || 'unpaid'
  const isPaid = normalizedStatus === 'paid'
  const normalizedPaymentStatus = isPaid ? 'paid' : (normalizedStatus === 'partial' ? 'partial' : normalizedStatus === 'overdue' ? 'overdue' : 'unpaid')
  const balance_due = isPaid ? 0 : invoice.balance_due

  return SalesInvoice.findByIdAndUpdate(
    id,
    { payment_status: normalizedPaymentStatus, balance_due },
    { new: true }
  )
}

export async function deleteSalesInvoice(id: string): Promise<ISalesInvoice | null> {
  return SalesInvoice.findByIdAndDelete(id)
}

// Get total pending sales quantity for a product (from sales invoices created when qty was 0)
export async function getPendingSalesQtyForProduct(productId: string): Promise<number> {
  const salesInvoices = await SalesInvoice.find({
    'line_items.product': productId,
  }).sort({ createdAt: 1 })
  
  let totalPendingQty = 0
  
  for (const invoice of salesInvoices) {
    for (const lineItem of invoice.line_items) {
      const itemProductId = typeof lineItem.product === 'string' 
        ? lineItem.product 
        : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
      
      if (itemProductId === productId) {
        totalPendingQty += lineItem.quantity || 0
      }
    }
  }
  
  return totalPendingQty
}
