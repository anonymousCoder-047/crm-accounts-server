import mongoose, { Schema, Document } from 'mongoose'

export interface IInventory extends Document {
  product_id?: string // Alias for _id, for consistency
  sku: string
  product_name: string
  category?: string
  description?: string
  unit_cost: number
  selling_price: number
  quantity_on_hand: number
  reorder_level?: number
  reorder_quantity?: number
  opening_stock?: number
  inventory_valuation_method: 'FIFO' | 'Weighted Average'
  tax_percent?: number
  is_active: boolean
  
  // Legacy fields for backward compatibility
  serialNumber?: string
  name?: string
  supplier?: mongoose.Types.ObjectId
  qty?: number
  productionDate?: Date
  expiryDate?: Date
  unit?: string
  brand?: mongoose.Types.ObjectId
  costPrice?: number
  vat?: number
  status?: 'normal' | 'pending_purchase' | 'pending_delivery'
  priceInclusiveMaterialCost?: boolean
  materialCostComponents?: Array<{
    account_id: string
    account_name: string
    amount: number
    description?: string
  }>
  
  createdAt: Date
  updatedAt: Date
}

const InventorySchema: Schema = new Schema(
  {
    sku: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // Allow multiple null/undefined values
      trim: true,
      index: true,
    },
    product_name: {
      type: String,
      required: false,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    unit_cost: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    selling_price: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    quantity_on_hand: {
      type: Number,
      required: false,
      default: 0,
    },
    reorder_level: {
      type: Number,
      min: 0,
    },
    reorder_quantity: {
      type: Number,
      min: 0,
    },
    opening_stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    inventory_valuation_method: {
      type: String,
      enum: ['FIFO', 'Weighted Average'],
      default: 'Weighted Average',
    },
    tax_percent: {
      type: Number,
      min: 0,
      max: 100,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    
    // Legacy fields for backward compatibility
    serialNumber: { type: String, trim: true, index: true },
    name: { type: String, trim: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', index: true },
    qty: { type: Number },
    productionDate: { type: Date },
    expiryDate: { type: Date },
    unit: { type: String, trim: true },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand' },
    costPrice: { type: Number, min: 0 },
    vat: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ['normal', 'pending_purchase', 'pending_delivery'],
      default: 'normal',
    },
    priceInclusiveMaterialCost: { type: Boolean, default: true },
    materialCostComponents: [{
      account_id: { type: String, required: true },
      account_name: { type: String, required: true },
      amount: { type: Number, required: true, min: 0 },
      description: { type: String },
    }],
  },
  { timestamps: true }
)

// Virtual for product_id (alias for _id)
InventorySchema.virtual('product_id').get(function() {
  return (this as any)._id.toString()
})

// Pre-save hook to sync legacy fields
InventorySchema.pre('save', function(next) {
  const doc = this as any as IInventory
  
  // Sync qty with quantity_on_hand if qty exists
  if (doc.qty !== undefined && doc.quantity_on_hand === undefined) {
    doc.quantity_on_hand = doc.qty
  } else if (doc.quantity_on_hand !== undefined && doc.qty === undefined) {
    doc.qty = doc.quantity_on_hand
  }
  
  // Sync name with product_name
  if (doc.name && !doc.product_name) {
    doc.product_name = doc.name
  } else if (doc.product_name && !doc.name) {
    doc.name = doc.product_name
  }
  
  // Sync serialNumber with sku
  if (doc.serialNumber && !doc.sku) {
    doc.sku = doc.serialNumber
  } else if (doc.sku && !doc.serialNumber) {
    doc.serialNumber = doc.sku
  }
  
  // Sync costPrice with unit_cost
  if (doc.costPrice !== undefined && doc.unit_cost === undefined) {
    doc.unit_cost = doc.costPrice
  } else if (doc.unit_cost !== undefined && doc.costPrice === undefined) {
    doc.costPrice = doc.unit_cost
  }
  
  // Sync vat with tax_percent
  if (doc.vat !== undefined && doc.tax_percent === undefined) {
    doc.tax_percent = doc.vat
  } else if (doc.tax_percent !== undefined && doc.vat === undefined) {
    doc.vat = doc.tax_percent
  }
  
  next()
})

// Indexes (only for fields without index: true in schema definition)
InventorySchema.index({ quantity_on_hand: 1 })

export default mongoose.model<IInventory>('Inventory', InventorySchema)


