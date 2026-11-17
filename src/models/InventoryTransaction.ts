import mongoose, { Schema, Document } from 'mongoose'

export interface IInventoryTransaction extends Document {
  product_id: mongoose.Types.ObjectId
  type: 'purchase' | 'sale' | 'adjustment_in' | 'adjustment_out' | 'return_in' | 'return_out'
  reference: string // invoice_number, purchase_invoice_id, sale_invoice_id, adjustment_id
  reference_id?: mongoose.Types.ObjectId // Optional reference to the source document
  quantity: number
  unit_cost: number
  total_cost: number
  date: Date
  notes?: string
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const InventoryTransactionSchema: Schema = new Schema(
  {
    product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['purchase', 'sale', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out'],
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    reference_id: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    unit_cost: {
      type: Number,
      required: true,
      min: 0,
    },
    total_cost: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

// Indexes for efficient querying (only compound indexes - single field indexes are defined in schema)
InventoryTransactionSchema.index({ product_id: 1, date: -1 })
InventoryTransactionSchema.index({ type: 1, date: -1 })
// Note: reference index removed - already indexed in schema definition

export default mongoose.model<IInventoryTransaction>('InventoryTransaction', InventoryTransactionSchema)








