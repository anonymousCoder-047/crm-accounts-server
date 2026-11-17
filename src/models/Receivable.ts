import mongoose, { Schema, Document } from 'mongoose'

export interface IPayment {
  date: Date
  amount: number
  paymentMethod?: string
  referenceNumber?: string
  notes?: string
  createdAt: Date
}

export interface IReceivable extends Document {
  customer_id: mongoose.Types.ObjectId // Customer reference
  invoice_number: string
  invoice_date: Date
  due_date: Date
  total_amount: number
  tax_amount: number
  currency: string
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  balance_due: number
  credit_limit?: number
  payment_terms?: string
  notes?: string
  payments: IPayment[]
  createdAt: Date
  updatedAt: Date
}

const PaymentSchema: Schema = new Schema(
  {
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, trim: true },
    referenceNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
)

const ReceivableSchema: Schema = new Schema(
  {
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    invoice_number: { type: String, required: true, trim: true, index: true },
    invoice_date: { type: Date, required: true, index: true },
    due_date: { type: Date, required: true, index: true },
    total_amount: { type: Number, required: true, min: 0 },
    tax_amount: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, required: true, default: 'AED', trim: true },
    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'overdue'],
      required: true,
      default: 'unpaid',
      index: true,
    },
    balance_due: { type: Number, required: true, min: 0 },
    credit_limit: { type: Number, min: 0 },
    payment_terms: { type: String, trim: true },
    notes: { type: String, trim: true },
    payments: [PaymentSchema],
  },
  { timestamps: true }
)

// Index for efficient querying
ReceivableSchema.index({ invoice_number: 1, customer_id: 1 })
ReceivableSchema.index({ status: 1, due_date: 1 })

// Pre-save hook to calculate status and balance_due
ReceivableSchema.pre('save', function (next) {
  const doc = this as any as IReceivable
  
  // Calculate total payments
  const totalPaid = doc.payments?.reduce((sum: number, payment: IPayment) => sum + payment.amount, 0) || 0
  
  // Calculate balance due
  doc.balance_due = Math.max(0, doc.total_amount - totalPaid)
  
  // Determine status
  const now = new Date()
  if (totalPaid >= doc.total_amount) {
    doc.status = 'paid'
    doc.balance_due = 0 // Ensure balance is 0 when fully paid
  } else if (totalPaid > 0) {
    // Partially paid - check if overdue
    if (doc.due_date < now) {
      doc.status = 'overdue'
    } else {
      doc.status = 'partial'
    }
  } else {
    // No payments - check if overdue
    if (doc.due_date < now) {
      doc.status = 'overdue'
    } else {
      doc.status = 'unpaid'
    }
  }
  
  next()
})

export default mongoose.model<IReceivable>('Receivable', ReceivableSchema)



