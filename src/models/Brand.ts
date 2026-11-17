import mongoose, { Schema, Document } from 'mongoose'

export interface IBrand extends Document {
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

const BrandSchema: Schema = new Schema(
  {
    name: { type: String, required: false, trim: true, unique: true, sparse: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
)

export default mongoose.model<IBrand>('Brand', BrandSchema)


