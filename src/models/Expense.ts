import mongoose, { Schema, Document } from 'mongoose'

export interface IExpense extends Document {
  expense_id: string // Unique identifier (can be same as serialNumber)
  serialNumber?: string // Legacy field for backward compatibility (same as expense_id)
  category: string // rent, utilities, travel, supplies, etc.
  vendor_id?: mongoose.Types.ObjectId // Optional supplier/vendor reference
  amount: number
  currency: string
  expense_date: Date
  payment_method?: string // cash, bank, credit
  reference_number?: string
  tax_amount: number
  description?: string
  attachments?: string[] // URLs or file paths for bills/receipts
  created_by: mongoose.Types.ObjectId
  associated_account: string // Expense account name
  status: string // Payment status (e.g., 'paid', 'unpaid', 'partial', etc.)
  payable_id?: mongoose.Types.ObjectId // Reference to Payable if unpaid
  payment_terms?: string // Payment terms (e.g., Net 30, Due on receipt, etc.)
  notes?: string // Additional notes or comments
  createdAt: Date
  updatedAt: Date
}

const ExpenseSchema: Schema = new Schema(
  {
    expense_id: { type: String, required: false, unique: true, sparse: true, trim: true, index: true },
    serialNumber: { type: String, required: false, unique: true, sparse: true, trim: true, index: true }, // Legacy field for backward compatibility
    category: { type: String, required: false, trim: true, index: true },
    vendor_id: { type: Schema.Types.ObjectId, ref: 'Supplier', index: true },
    amount: { type: Number, required: false, default: 0, min: 0 },
    currency: { type: String, required: false, default: 'AED', trim: true },
    expense_date: { type: Date, required: false, default: Date.now, index: true },
    payment_method: { type: String, trim: true },
    reference_number: { type: String, trim: true },
    tax_amount: { type: Number, required: false, min: 0, default: 0 },
    description: { type: String, trim: true },
    attachments: [{ type: String, trim: true }],
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: false, index: true },
    associated_account: { type: String, required: false, trim: true },
    status: {
      type: String,
      required: false,
      default: 'paid',
      index: true,
      trim: true,
    },
    payable_id: { type: Schema.Types.ObjectId, ref: 'Payable', index: true },
    payment_terms: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
)

// Index for efficient querying
ExpenseSchema.index({ expense_date: -1, category: 1 })
ExpenseSchema.index({ status: 1, expense_date: -1 })
ExpenseSchema.index({ vendor_id: 1, expense_date: -1 })

export default mongoose.model<IExpense>('Expense', ExpenseSchema)


