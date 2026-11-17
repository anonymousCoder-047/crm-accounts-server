import mongoose, { Schema, Document } from 'mongoose'

export interface IPurchaseInvoiceLineItem {
  product: mongoose.Types.ObjectId
  description?: string
  quantity: number
  unit_cost: number
  total: number
  discount?: number
  vat?: number
}

export interface IPurchaseInvoice extends Document {
  invoice_number: string
  vendor_id: mongoose.Types.ObjectId // Supplier/Vendor reference
  invoice_date: Date
  due_date: Date
  line_items: IPurchaseInvoiceLineItem[]
  subtotal: number
  tax_amount: number
  discount: number
  total_amount: number
  currency: string
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  balance_due: number
  payment_terms?: string
  notes?: string
  payable_id?: mongoose.Types.ObjectId // Reference to Payable if unpaid purchase
  payment_method?: string // For cash purchases
  reference_number?: string // Payment reference for cash purchases
  trn?: string
  createdAt: Date
  updatedAt: Date
}

const PurchaseInvoiceLineItemSchema: Schema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit_cost: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, default: 0 },
    vat: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
)

const PurchaseInvoiceSchema: Schema = new Schema(
  {
    invoice_number: { type: String, required: true, unique: true, trim: true, index: true },
    vendor_id: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    invoice_date: { type: Date, required: true, index: true },
    due_date: { type: Date, required: true, index: true },
    line_items: [PurchaseInvoiceLineItemSchema],
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    tax_amount: { type: Number, required: true, min: 0, default: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    total_amount: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, required: true, default: 'AED', trim: true },
    payment_status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'overdue'],
      required: true,
      default: 'unpaid',
      index: true,
    },
    balance_due: { type: Number, required: true, min: 0, default: 0 },
    payment_terms: { type: String, trim: true },
    notes: { type: String, trim: true },
    payable_id: { type: Schema.Types.ObjectId, ref: 'Payable', index: true },
    payment_method: { type: String, trim: true },
    reference_number: { type: String, trim: true },
    trn: { type: String, trim: true },
  },
  { timestamps: true }
)

// Index for efficient querying (only compound indexes - single field indexes are defined in schema)
PurchaseInvoiceSchema.index({ invoice_date: -1, vendor_id: 1 })
PurchaseInvoiceSchema.index({ payment_status: 1, due_date: 1 })

// Pre-save hook to calculate status and balance_due
PurchaseInvoiceSchema.pre('save', function (next) {
  const doc = this as any as IPurchaseInvoice
  
  // Set default payment_status to 'unpaid' if not provided or invalid
  if (!doc.payment_status || !['unpaid', 'partial', 'paid', 'overdue'].includes(doc.payment_status)) {
    doc.payment_status = 'unpaid'
  }
  
  // Calculate balance_due (for credit purchases, this will be updated when payments are made)
  // For cash purchases, balance_due should be 0 if paid
  if (doc.payment_status === 'paid' && !doc.payable_id) {
    // Cash purchase that's paid
    doc.balance_due = 0
  } else if (doc.payable_id) {
    // Credit purchase - balance_due will be managed by Payable
    // This will be synced from the Payable record
  }
  
  // Determine overdue status ONLY on updates (not new documents) and ONLY if status is 'unpaid' or 'partial'
  // Don't override 'paid' or explicitly set statuses
  // Only check overdue if this is an update (not a new document) and status is unpaid/partial
  // Mongoose sets isNew property automatically - true for new documents, false for existing ones
  if (!doc.isNew) {
    // This is an update, check if invoice is overdue
    const now = new Date()
    if ((doc.payment_status === 'unpaid' || doc.payment_status === 'partial') && doc.due_date < now) {
      // Only set to overdue if it's currently unpaid/partial and past due date
      doc.payment_status = 'overdue'
    }
  }
  // For new documents, keep the default 'unpaid' status even if due_date is in the past
  // The overdue status will be set on the next update or via a scheduled job
  
  next()
})

export default mongoose.model<IPurchaseInvoice>('PurchaseInvoice', PurchaseInvoiceSchema)


