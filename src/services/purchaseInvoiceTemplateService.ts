import PurchaseInvoiceTemplate, { IPurchaseInvoiceTemplate } from '../models/PurchaseInvoiceTemplate'
import mongoose from 'mongoose'

export interface CreatePurchaseTemplateInput {
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
  createdBy?: mongoose.Types.ObjectId
}

export interface UpdatePurchaseTemplateInput {
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
  updatedBy?: mongoose.Types.ObjectId
}

export async function createPurchaseTemplate(
  input: CreatePurchaseTemplateInput
): Promise<IPurchaseInvoiceTemplate> {
  if (input.isDefault) {
    await PurchaseInvoiceTemplate.updateMany({}, { isDefault: false })
  }
  return PurchaseInvoiceTemplate.create(input as any)
}

export async function listPurchaseTemplates(): Promise<IPurchaseInvoiceTemplate[]> {
  return PurchaseInvoiceTemplate.find().sort({ isDefault: -1, createdAt: -1 })
}

export async function getPurchaseTemplateById(id: string): Promise<IPurchaseInvoiceTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  return PurchaseInvoiceTemplate.findById(id)
}

export async function getDefaultPurchaseTemplate(): Promise<IPurchaseInvoiceTemplate | null> {
  return PurchaseInvoiceTemplate.findOne({ isDefault: true })
}

export async function updatePurchaseTemplate(
  id: string,
  input: UpdatePurchaseTemplateInput
): Promise<IPurchaseInvoiceTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  if (input.isDefault) {
    await PurchaseInvoiceTemplate.updateMany({ _id: { $ne: id } }, { isDefault: false })
  }
  return PurchaseInvoiceTemplate.findByIdAndUpdate(id, input, { new: true, runValidators: true })
}

export async function deletePurchaseTemplate(id: string): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) return false
  const result = await PurchaseInvoiceTemplate.findByIdAndDelete(id)
  return !!result
}

export async function setDefaultPurchaseTemplate(id: string): Promise<IPurchaseInvoiceTemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null
  await PurchaseInvoiceTemplate.updateMany({}, { isDefault: false })
  return PurchaseInvoiceTemplate.findByIdAndUpdate(id, { isDefault: true }, { new: true })
}


