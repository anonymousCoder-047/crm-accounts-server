import mongoose, { Schema, Document } from 'mongoose'

export interface ICustomer extends Document {
  name: string
  email?: string
  phone?: string
  trn?: string
  address?: string
  createdAt: Date
  updatedAt: Date
}

const CustomerSchema: Schema = new Schema(
  {
    name: { type: String, required: false, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    trn: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { timestamps: true }
)

export default mongoose.model<ICustomer>('Customer', CustomerSchema)


