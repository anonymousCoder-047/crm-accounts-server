import mongoose, { Document, Schema } from 'mongoose'

export interface IOnboarding extends Document {
  business_name: string
  country: string
  currency: string
  fiscal_year_start: Date
  tax_registration_number?: string
  logo_url?: string
  chart_of_accounts_initialized: boolean
  opening_balances_set: boolean
  tax_configured: boolean
  inventory_setup: boolean
  payment_methods_setup: boolean
  users_setup: boolean
  integrations_setup: boolean
  is_completed: boolean
  completed_at?: Date
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const OnboardingSchema: Schema = new Schema(
  {
    business_name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    currency: { type: String, required: true, default: 'AED', trim: true },
    fiscal_year_start: { type: Date, required: true },
    tax_registration_number: { type: String, trim: true },
    logo_url: { type: String, trim: true },
    chart_of_accounts_initialized: { type: Boolean, default: false },
    opening_balances_set: { type: Boolean, default: false },
    tax_configured: { type: Boolean, default: false },
    inventory_setup: { type: Boolean, default: false },
    payment_methods_setup: { type: Boolean, default: false },
    users_setup: { type: Boolean, default: false },
    integrations_setup: { type: Boolean, default: false },
    is_completed: { type: Boolean, default: false },
    completed_at: { type: Date },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

export default mongoose.model<IOnboarding>('Onboarding', OnboardingSchema)

