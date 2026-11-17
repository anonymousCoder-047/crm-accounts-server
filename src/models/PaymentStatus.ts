import mongoose, { Schema, Document } from 'mongoose'

export interface IPaymentStatus extends Document {
  name: string
  description?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const PaymentStatusSchema: Schema = new Schema(
  {
    name: { type: String, required: false, unique: true, sparse: true, trim: true, index: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.model<IPaymentStatus>('PaymentStatus', PaymentStatusSchema)

