import mongoose, { Schema, Document } from 'mongoose'

export interface IUnit extends Document {
  name: string
  symbol?: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

const UnitSchema: Schema = new Schema(
  {
    name: { type: String, required: false, unique: true, sparse: true, trim: true },
    symbol: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
)

export default mongoose.model<IUnit>('Unit', UnitSchema)

