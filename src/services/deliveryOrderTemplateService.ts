import DeliveryOrderTemplate, { IDeliveryOrderTemplate } from '../models/DeliveryOrderTemplate'
import mongoose from 'mongoose'

export interface CreateDeliveryOrderTemplateInput {
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

export interface UpdateDeliveryOrderTemplateInput {
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

export async function createTemplate(input: CreateDeliveryOrderTemplateInput): Promise<IDeliveryOrderTemplate> {
  // If setting as default, unset other defaults
  if (input.isDefault) {
    await DeliveryOrderTemplate.updateMany({}, { isDefault: false })
  }

  return DeliveryOrderTemplate.create(input as any)
}

export async function listTemplates(): Promise<IDeliveryOrderTemplate[]> {
  return DeliveryOrderTemplate.find().sort({ isDefault: -1, createdAt: -1 })
}

export async function getTemplateById(id: string): Promise<IDeliveryOrderTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null
  }
  return DeliveryOrderTemplate.findById(id)
}

export async function getDefaultTemplate(): Promise<IDeliveryOrderTemplate | null> {
  return DeliveryOrderTemplate.findOne({ isDefault: true })
}

export async function updateTemplate(
  id: string,
  input: UpdateDeliveryOrderTemplateInput
): Promise<IDeliveryOrderTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null
  }

  // If setting as default, unset other defaults
  if (input.isDefault) {
    await DeliveryOrderTemplate.updateMany({ _id: { $ne: id } }, { isDefault: false })
  }

  return DeliveryOrderTemplate.findByIdAndUpdate(id, input, { new: true, runValidators: true })
}

export async function deleteTemplate(id: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return false
  }

  const result = await DeliveryOrderTemplate.findByIdAndDelete(id)
  return !!result
}

export async function setDefaultTemplate(id: string): Promise<IDeliveryOrderTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null
  }

  // Unset all other defaults
  await DeliveryOrderTemplate.updateMany({}, { isDefault: false })

  // Set this one as default
  return DeliveryOrderTemplate.findByIdAndUpdate(id, { isDefault: true }, { new: true })
}
