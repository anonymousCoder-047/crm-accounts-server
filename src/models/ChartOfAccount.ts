import mongoose, { Document, Schema } from 'mongoose'

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface IChartOfAccount extends Document {
  account_id: string
  account_name: string
  account_type: AccountType
  is_contra: boolean
  is_active: boolean
  createdAt: Date
  updatedAt: Date
}

const ChartOfAccountSchema = new Schema<IChartOfAccount>(
  {
    account_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    account_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    account_type: {
      type: String,
      required: true,
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      index: true,
    },
    is_contra: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
)

ChartOfAccountSchema.index({ account_type: 1, account_id: 1 })

export default mongoose.model<IChartOfAccount>('ChartOfAccount', ChartOfAccountSchema)



