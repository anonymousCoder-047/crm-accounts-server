import mongoose, { Schema, Document } from 'mongoose'

export interface IDeliveryOrderTemplate extends Document {
  name: string
  description?: string
  isDefault: boolean
  layout?: any
  styling?: any
  fieldsVisibility?: {
    [key: string]: boolean
  }
  customFields?: Array<{
    name: string
    type: 'text' | 'number' | 'date' | 'textarea'
    position: string
    required: boolean
  }>
  // Visual design elements for the designer
  design?: any // Accept any structure - supports both old (elements) and new (Tax Invoice) formats
  // Legacy fields for backward compatibility
  companyNameEn?: string
  companyNameAr?: string
  companyAddressEn?: string
  companyAddressAr?: string
  companyContactEn?: string
  companyContactAr?: string
  footerTextEn?: string
  footerTextAr?: string
  logo?: string
  createdBy?: mongoose.Types.ObjectId
  updatedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const DeliveryOrderTemplateSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    layout: { type: Object, default: {} },
    styling: { type: Object, default: {} },
    fieldsVisibility: { type: Map, of: Boolean, default: {} },
    customFields: [
      {
        name: { type: String, required: true },
        type: { type: String, enum: ['text', 'number', 'date', 'textarea'], required: true },
        position: { type: String, required: true },
        required: { type: Boolean, default: false },
      },
    ],
    design: {
      type: Schema.Types.Mixed, // Accept any structure - supports both old (elements) and new (Tax Invoice) formats
      default: {},
    },
    // Legacy fields
    companyNameEn: { type: String },
    companyNameAr: { type: String },
    companyAddressEn: { type: String },
    companyAddressAr: { type: String },
    companyContactEn: { type: String },
    companyContactAr: { type: String },
    footerTextEn: { type: String },
    footerTextAr: { type: String },
    logo: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

// Ensure single default
DeliveryOrderTemplateSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('DeliveryOrderTemplate').updateMany({ _id: { $ne: this._id } }, { isDefault: false })
  }
  next()
})

export default mongoose.model<IDeliveryOrderTemplate>('DeliveryOrderTemplate', DeliveryOrderTemplateSchema)
