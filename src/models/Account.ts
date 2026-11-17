import mongoose, { Document, Schema } from 'mongoose'

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

export type AccountSubType =
  // Asset sub-types
  | 'Current Asset'
  | 'Non-Current Asset'
  | 'Contra Asset'
  // Liability sub-types
  | 'Current Liability'
  | 'Non-Current Liability'
  // Equity sub-types
  | 'Owner Capital'
  | 'Retained Earnings'
  | 'Reserves'
  // Revenue sub-types
  | 'Operating Revenue'
  | 'Non-Operating Revenue'
  // Expense sub-types
  | 'Operating Expense'
  | 'Non-Operating Expense'
  | 'COGS'

export interface IAccount extends Document {
  account_id: string
  account_name: string
  account_type: AccountType
  account_sub_type: AccountSubType
  parent_account_id?: mongoose.Types.ObjectId
  account_code?: string
  description?: string
  is_system_account: boolean
  is_active: boolean
  opening_balance: number
  current_balance: number
  currency: string
  createdAt: Date
  updatedAt: Date
}

const AccountSchema: Schema = new Schema(
  {
    account_id: { type: String, required: true, unique: true, trim: true, index: true },
    account_name: { type: String, required: true, trim: true, index: true },
    account_type: {
      type: String,
      enum: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'],
      required: true,
      index: true,
    },
    account_sub_type: {
      type: String,
      enum: [
        // Asset sub-types
        'Current Asset',
        'Non-Current Asset',
        'Contra Asset',
        // Liability sub-types
        'Current Liability',
        'Non-Current Liability',
        // Equity sub-types
        'Owner Capital',
        'Retained Earnings',
        'Reserves',
        // Revenue sub-types
        'Operating Revenue',
        'Non-Operating Revenue',
        // Expense sub-types
        'Operating Expense',
        'Non-Operating Expense',
        'COGS',
      ],
      required: false, // Optional for backward compatibility during migration
      index: true,
    },
    parent_account_id: { type: Schema.Types.ObjectId, ref: 'Account', index: true },
    account_code: { type: String, trim: true, index: true },
    description: { type: String, trim: true },
    is_system_account: { type: Boolean, default: false, index: true },
    is_active: { type: Boolean, default: true, index: true },
    opening_balance: { type: Number, default: 0 },
    current_balance: { type: Number, default: 0 },
    currency: { type: String, required: true, default: 'AED', trim: true },
  },
  { timestamps: true }
)

// Indexes (only compound indexes - single field indexes are defined in schema)
AccountSchema.index({ account_type: 1, is_active: 1 })
AccountSchema.index({ account_type: 1, account_sub_type: 1 })
// Note: account_code index removed - already indexed in schema definition

// Pre-save hook to generate account_id
AccountSchema.pre('save', function (next) {
  const doc = this as any as IAccount
  if (!doc.account_id) {
    const prefix = doc.account_type === 'Asset' ? 'ASSET' :
                   doc.account_type === 'Liability' ? 'LIAB' :
                   doc.account_type === 'Equity' ? 'EQUITY' :
                   doc.account_type === 'Revenue' ? 'REV' : 'EXP'
    doc.account_id = `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
  }
  next()
})

export default mongoose.model<IAccount>('Account', AccountSchema)

