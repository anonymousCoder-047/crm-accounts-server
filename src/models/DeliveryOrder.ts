import mongoose, { Schema, Document } from 'mongoose'

export interface IDeliveryOrderLineItem {
  product: mongoose.Types.ObjectId
  qty: number
  delivered: boolean // Yes/No for each line item
}

export interface IDeliveryOrder extends Document {
  serialNumber: string
  invoiceNumber: mongoose.Types.ObjectId // Reference to SalesInvoice
  date: Date
  customer: mongoose.Types.ObjectId // Reference to Customer
  deliveryAddress?: string
  lineItems: IDeliveryOrderLineItem[]
  attachments?: string[] // Array of file paths
  attachment?: string // Legacy single file path (for backward compatibility)
  createdAt: Date
  updatedAt: Date
}

const DeliveryOrderSchema: Schema = new Schema(
  {
    serialNumber: { type: String, required: true, unique: true, trim: true, index: true },
    invoiceNumber: { type: Schema.Types.ObjectId, ref: 'SalesInvoice', required: true, index: true },
    date: { type: Date, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    deliveryAddress: { type: String, trim: true },
    lineItems: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Inventory', required: true },
        qty: { type: Number, required: true, min: 0 },
        delivered: { type: Boolean, default: false }, // Yes/No for delivery status
      },
    ],
    attachments: [{ type: String, trim: true }], // Array of file paths stored in uploads/DO/{invoiceNumber}-{date}/
    attachment: { type: String, trim: true }, // Legacy single file path (for backward compatibility)
  },
  { timestamps: true }
)

export default mongoose.model<IDeliveryOrder>('DeliveryOrder', DeliveryOrderSchema)

