import mongoose, { Schema, Document } from 'mongoose'

export interface ITemplateLayout {
  header?: {
    showLogo?: boolean
    logoPosition?: 'left' | 'center' | 'right'
    showCompanyName?: boolean
    showCompanyAddress?: boolean
    showCompanyContact?: boolean
  }
  body?: {
    showInvoiceNumber?: boolean
    showDate?: boolean
    showCustomerDetails?: boolean
    showDeliveryAddress?: boolean
    showLineItems?: boolean
    showDiscount?: boolean
    showVat?: boolean
    showTotal?: boolean
    showPaymentMethod?: boolean
    showStatus?: boolean
    showTrn?: boolean
  }
  footer?: {
    showTerms?: boolean
    showNotes?: boolean
    customFooter?: string
  }
}

export interface ITemplateStyling {
  primaryColor?: string
  secondaryColor?: string
  fontFamily?: string
  fontSize?: string
  borderStyle?: string
  logoSize?: string
}

export interface ITemplateDesignElement {
  id: string
  type: 'text' | 'image' | 'table' | 'line' | 'rectangle'
  x: number // Position in pixels or percentage
  y: number
  width?: number
  height?: number
  content?: string // For text elements, can contain {{variables}}
  style?: {
    fontSize?: number
    fontFamily?: string
    fontWeight?: 'normal' | 'bold' | 'italic'
    color?: string
    backgroundColor?: string
    textAlign?: 'left' | 'center' | 'right'
    borderWidth?: number
    borderColor?: string
    borderStyle?: 'solid' | 'dashed' | 'dotted'
    padding?: number
    margin?: number
  }
  // For image elements
  imageUrl?: string
  imageData?: string // Base64
  // For table elements (line items)
  tableConfig?: {
    columns: Array<{
      field: string // e.g., 'product', 'qty', 'unitPrice', 'total'
      label: string
      width?: number
      align?: 'left' | 'center' | 'right'
    }>
    showHeader?: boolean
    showBorders?: boolean
  }
  // For bilingual support
  contentEn?: string
  contentAr?: string
  rtl?: boolean // Right-to-left for Arabic
}

export interface ISalesInvoiceTemplate extends Document {
  name: string
  description?: string
  isDefault: boolean
  layout: ITemplateLayout
  styling: ITemplateStyling
  fieldsVisibility: {
    [key: string]: boolean
  }
  customFields?: Array<{
    name: string
    type: 'text' | 'number' | 'date' | 'textarea'
    position: string
    required: boolean
  }>
  // Visual design elements for the designer
  design?: {
    pageWidth?: number // Default: 210mm (A4 width)
    pageHeight?: number // Default: 297mm (A4 height)
    elements: ITemplateDesignElement[]
  }
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

const SalesInvoiceTemplateSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    layout: {
      type: {
        header: {
          type: {
            showLogo: Boolean,
            logoPosition: { type: String, enum: ['left', 'center', 'right'] },
            showCompanyName: Boolean,
            showCompanyAddress: Boolean,
            showCompanyContact: Boolean,
          },
          default: {},
        },
        body: {
          type: {
            showInvoiceNumber: Boolean,
            showDate: Boolean,
            showCustomerDetails: Boolean,
            showDeliveryAddress: Boolean,
            showLineItems: Boolean,
            showDiscount: Boolean,
            showVat: Boolean,
            showTotal: Boolean,
            showPaymentMethod: Boolean,
            showStatus: Boolean,
            showTrn: Boolean,
          },
          default: {},
        },
        footer: {
          type: {
            showTerms: Boolean,
            showNotes: Boolean,
            customFooter: String,
          },
          default: {},
        },
      },
      default: {},
    },
    styling: {
      type: {
        primaryColor: String,
        secondaryColor: String,
        fontFamily: String,
        fontSize: String,
        borderStyle: String,
        logoSize: String,
      },
      default: {},
    },
    fieldsVisibility: {
      type: Map,
      of: Boolean,
      default: {},
    },
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

// Ensure only one default template exists
SalesInvoiceTemplateSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('SalesInvoiceTemplate').updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    )
  }
  next()
})

export default mongoose.model<ISalesInvoiceTemplate>('SalesInvoiceTemplate', SalesInvoiceTemplateSchema)

