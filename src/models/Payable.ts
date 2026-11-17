import mongoose, { Schema, Document } from 'mongoose'

export interface IPayment {
  date: Date
  amount: number
  paymentMethod?: string
  referenceNumber?: string
  notes?: string
  createdAt: Date
}

export interface IPayable extends Document {
  vendor_id: mongoose.Types.ObjectId // Supplier/Vendor reference
  bill_number: string
  bill_date: Date
  due_date: Date
  total_amount: number
  tax_amount: number
  currency: string
  status: 'unpaid' | 'partial' | 'paid' | 'overdue'
  balance_due: number
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

const PayableSchema: Schema = new Schema(
  {
    vendor_id: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    bill_number: { type: String, required: true, trim: true, index: true },
    bill_date: { type: Date, required: true, index: true },
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
    payment_terms: { type: String, trim: true },
    notes: { type: String, trim: true },
    payments: [PaymentSchema],
  },
  { timestamps: true }
)

// Index for efficient querying
PayableSchema.index({ bill_number: 1, vendor_id: 1 })
PayableSchema.index({ status: 1, due_date: 1 })

// Pre-save hook to calculate status and balance_due
PayableSchema.pre('save', function (next) {
  const doc = this as any as IPayable
  
  // Calculate total payments
  const totalPaid = doc.payments?.reduce((sum: number, payment: IPayment) => sum + payment.amount, 0) || 0
  
  // Calculate balance due
  doc.balance_due = Math.max(0, doc.total_amount - totalPaid)
  
  // Determine status
  const now = new Date()
  if (totalPaid >= doc.total_amount) {
    doc.status = 'paid'
  } else if (totalPaid > 0) {
    doc.status = 'partial'
  } else if (doc.due_date < now) {
    doc.status = 'overdue'
  } else {
    doc.status = 'unpaid'
  }
  
  next()
})

export default mongoose.model<IPayable>('Payable', PayableSchema)

