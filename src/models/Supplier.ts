import mongoose, { Schema, Document } from 'mongoose'

export interface ISupplier extends Document {
  name: string
  email?: string
  phone?: string
  trn?: string
  address?: string
  createdAt: Date
  updatedAt: Date
}

const SupplierSchema: Schema = new Schema(
  {
    name: { type: String, required: false, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    trn: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { timestamps: true }
)

export default mongoose.model<ISupplier>('Supplier', SupplierSchema)


