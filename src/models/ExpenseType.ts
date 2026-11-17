import mongoose, { Schema, Document } from 'mongoose'

export interface IExpenseType extends Document {
  name: string
  description?: string
  recurring?: boolean
  createdAt: Date
  updatedAt: Date
}

const ExpenseTypeSchema: Schema = new Schema(
  {
    name: { type: String, required: false, unique: true, sparse: true, trim: true },
    description: { type: String, trim: true },
    recurring: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export default mongoose.model<IExpenseType>('ExpenseType', ExpenseTypeSchema)

