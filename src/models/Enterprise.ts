import mongoose, { Schema, Document } from 'mongoose'

export interface IEnterprise extends Document {
  name: string
  email: string
  phone: string
  address: string
  industry: string
  status: 'active' | 'inactive' | 'pending'
  createdAt: Date
  updatedAt: Date
}

const EnterpriseSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a company name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Please provide a phone number'],
    },
    address: {
      type: String,
      trim: true,
    },
    industry: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
)

export default mongoose.model<IEnterprise>('Enterprise', EnterpriseSchema)

