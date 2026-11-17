import mongoose, { Schema, Document } from 'mongoose'

export interface ICurrency extends Document {
  code: string // e.g., 'AED', 'USD', 'EUR'
  name: string // e.g., 'UAE Dirham', 'US Dollar'
  symbol?: string // e.g., 'د.إ', '$', '€'
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const CurrencySchema: Schema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true },
    symbol: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// Ensure single default currency
CurrencySchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('Currency').updateMany({ _id: { $ne: this._id } }, { isDefault: false })
  }
  next()
})

export default mongoose.model<ICurrency>('Currency', CurrencySchema)


