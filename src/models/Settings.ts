import mongoose, { Schema, Document } from 'mongoose'

export interface ISettings extends Document {
  businessInformation: {
    companyName?: string
    registrationNumber?: string
    website?: string
    phone?: string
    supportEmail?: string
    logoUrl?: string
  }
  companyAddress: {
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
  taxInformation: {
    trn?: string
    vatNumber?: string
  }
  themeColors: {
    primary?: string
    secondary?: string
    accent?: string
  }
  emailSettings: {
    smtpHost?: string
    smtpPort?: number
    smtpUser?: string
    smtpFrom?: string
    secure?: boolean
  }
  notificationSettings: {
    emailEnabled?: boolean
    pushEnabled?: boolean
  }
  createdAt: Date
  updatedAt: Date
}

const SettingsSchema: Schema = new Schema(
  {
    businessInformation: {
      companyName: String,
      registrationNumber: String,
      website: String,
      phone: String,
      supportEmail: String,
      logoUrl: String,
    },
    companyAddress: {
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    taxInformation: {
      trn: String,
      vatNumber: String,
    },
    themeColors: {
      primary: { type: String, default: '#10b981' },
      secondary: { type: String, default: '#E21C1C' },
      accent: { type: String, default: '#cccccc' },
    },
    emailSettings: {
      smtpHost: String,
      smtpPort: Number,
      smtpUser: String,
      smtpFrom: String,
      secure: { type: Boolean, default: false },
    },
    notificationSettings: {
      emailEnabled: { type: Boolean, default: true },
      pushEnabled: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
)

export default mongoose.model<ISettings>('Settings', SettingsSchema)


