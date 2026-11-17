import mongoose, { Schema, Document } from 'mongoose'

export interface IPurchaseTemplateLayout {
  header?: {
    showLogo?: boolean
    logoPosition?: 'left' | 'center' | 'right'
    showSupplierBlock?: boolean
    showCompanyDetails?: boolean
  }
  body?: {
    showPurchaseNumber?: boolean
    showDate?: boolean
    showSupplierDetails?: boolean
    showLineItems?: boolean
    showDiscount?: boolean
    showVat?: boolean
    showTotal?: boolean
    showStatus?: boolean
  }
  footer?: {
    showTerms?: boolean
    showNotes?: boolean
    customFooter?: string
  }
}

export interface IPurchaseTemplateStyling {
  primaryColor?: string
  secondaryColor?: string
  fontFamily?: string
  fontSize?: string
  borderStyle?: string
  logoSize?: string
}

export interface IPurchaseTemplateDesignElement {
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
    borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'inset' | 'outset' | 'none'
    padding?: number
    margin?: number
    opacity?: number
    borderRadius?: number
    lineHeight?: number
    letterSpacing?: number
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
      dataTemplate?: string
      backgroundColor?: string
    }>
    showHeader?: boolean
    showBorders?: boolean
    headerRowHeight?: number
    headerRowBackgroundColor?: string
    bodyRowHeight?: number
    bodyRowBackgroundColor?: string
    alternateRowBackgroundColor?: string
  }
  // For bilingual support
  contentEn?: string
  contentAr?: string
  rtl?: boolean // Right-to-left for Arabic
  locked?: boolean
}

export interface IPurchaseInvoiceTemplate extends Document {
  name: string
  description?: string
  isDefault: boolean
  layout: IPurchaseTemplateLayout
  styling: IPurchaseTemplateStyling
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
    elements: IPurchaseTemplateDesignElement[]
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

const PurchaseInvoiceTemplateSchema: Schema = new Schema(
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
PurchaseInvoiceTemplateSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    await mongoose.model('PurchaseInvoiceTemplate').updateMany({ _id: { $ne: this._id } }, { isDefault: false })
  }
  next()
})

export default mongoose.model<IPurchaseInvoiceTemplate>('PurchaseInvoiceTemplate', PurchaseInvoiceTemplateSchema)


