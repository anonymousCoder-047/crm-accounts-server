import mongoose, { Schema, Document } from 'mongoose'

export interface ISalesInvoiceLineItem {
  product: mongoose.Types.ObjectId
  description?: string
  quantity: number
  unit_price: number
  total: number
  discount?: number
  vat?: number
}

export interface ISalesInvoice extends Document {
  invoice_number: string
  customer_id: mongoose.Types.ObjectId
  invoice_date: Date
  due_date: Date
  line_items: ISalesInvoiceLineItem[]
  subtotal: number
  tax_amount: number
  discount: number
  total_amount: number
  currency: string
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  balance_due: number
  payment_terms?: string
  notes?: string
  receivable_id?: mongoose.Types.ObjectId // Reference to Receivable if credit sale
  payment_method?: string // For cash sales
  reference_number?: string // Payment reference for cash sales
  trn?: string
  isExportInvoice?: boolean // true = Export Invoice (no VAT), false = Local Invoice (with VAT)
  createdAt: Date
  updatedAt: Date
}

const SalesInvoiceLineItemSchema: Schema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit_price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    discount: { type: Number, min: 0, default: 0 },
    vat: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
)

const SalesInvoiceSchema: Schema = new Schema(
  {
    invoice_number: { type: String, required: true, unique: true, trim: true, index: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    invoice_date: { type: Date, required: true, index: true },
    due_date: { type: Date, required: true, index: true },
    line_items: [SalesInvoiceLineItemSchema],
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
    receivable_id: { type: Schema.Types.ObjectId, ref: 'Receivable', index: true },
    payment_method: { type: String, trim: true },
    reference_number: { type: String, trim: true },
    trn: { type: String, trim: true },
    isExportInvoice: { type: Boolean, default: false },
  },
  { timestamps: true }
)

// Index for efficient querying (only compound indexes - single field indexes are defined in schema)
SalesInvoiceSchema.index({ invoice_date: -1, customer_id: 1 })
SalesInvoiceSchema.index({ payment_status: 1, due_date: 1 })

// Pre-save hook to calculate status and balance_due
SalesInvoiceSchema.pre('save', function (next) {
  const doc = this as any as ISalesInvoice
  
  // Calculate balance_due (for credit sales, this will be updated when payments are received)
  // For cash sales, balance_due should be 0 if paid
  if (doc.payment_status === 'paid' && !doc.receivable_id) {
    // Cash sale that's paid
    doc.balance_due = 0
  } else if (doc.receivable_id) {
    // Credit sale - balance_due will be managed by Receivable
    // This will be synced from the Receivable record
  }
  
  // Determine overdue status
  const now = new Date()
  if (doc.payment_status !== 'paid' && doc.due_date < now) {
    doc.payment_status = 'overdue'
  }
  
  next()
})

export default mongoose.model<ISalesInvoice>('SalesInvoice', SalesInvoiceSchema)
