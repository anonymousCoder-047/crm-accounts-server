import SalesInvoiceTemplate, { ISalesInvoiceTemplate } from '../models/SalesInvoiceTemplate'
import mongoose from 'mongoose'

export interface CreateTemplateInput {
  name: string
  description?: string
  isDefault?: boolean
  layout?: any
  styling?: any
  fieldsVisibility?: { [key: string]: boolean }
  customFields?: Array<{
    name: string
    type: 'text' | 'number' | 'date' | 'textarea'
    position: string
    required: boolean
  }>
  design?: any // Accept any structure - supports both old (elements) and new (Tax Invoice) formats
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
}

export interface UpdateTemplateInput {
  name?: string
  description?: string
  isDefault?: boolean
  layout?: any
  styling?: any
  fieldsVisibility?: { [key: string]: boolean }
  customFields?: Array<{
    name: string
    type: 'text' | 'number' | 'date' | 'textarea'
    position: string
    required: boolean
  }>
  design?: any // Accept any structure - supports both old (elements) and new (Tax Invoice) formats
  companyNameEn?: string
  companyNameAr?: string
  companyAddressEn?: string
  companyAddressAr?: string
  companyContactEn?: string
  companyContactAr?: string
  footerTextEn?: string
  footerTextAr?: string
  logo?: string
  updatedBy?: mongoose.Types.ObjectId
}

export async function createTemplate(input: CreateTemplateInput): Promise<ISalesInvoiceTemplate> {
  // If setting as default, unset other defaults
  if (input.isDefault) {
    await SalesInvoiceTemplate.updateMany({}, { isDefault: false })
  }

  return SalesInvoiceTemplate.create(input as any)
}

export async function listTemplates(): Promise<ISalesInvoiceTemplate[]> {
  return SalesInvoiceTemplate.find().sort({ isDefault: -1, createdAt: -1 })
}

export async function getTemplateById(id: string): Promise<ISalesInvoiceTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null
  }
  return SalesInvoiceTemplate.findById(id)
}

export async function getDefaultTemplate(): Promise<ISalesInvoiceTemplate | null> {
  return SalesInvoiceTemplate.findOne({ isDefault: true })
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<ISalesInvoiceTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null
  }

  // If setting as default, unset other defaults
  if (input.isDefault) {
    await SalesInvoiceTemplate.updateMany({ _id: { $ne: id } }, { isDefault: false })
  }

  return SalesInvoiceTemplate.findByIdAndUpdate(id, input, { new: true, runValidators: true })
}

export async function deleteTemplate(id: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return false
  }

  const result = await SalesInvoiceTemplate.findByIdAndDelete(id)
  return !!result
}

export async function setDefaultTemplate(id: string): Promise<ISalesInvoiceTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null
  }

  // Unset all defaults
  await SalesInvoiceTemplate.updateMany({}, { isDefault: false })

  // Set this one as default
  return SalesInvoiceTemplate.findByIdAndUpdate(id, { isDefault: true }, { new: true })
}

