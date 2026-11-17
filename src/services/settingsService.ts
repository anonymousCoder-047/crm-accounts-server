import Settings, { ISettings } from '../models/Settings'

export async function getSettings(): Promise<ISettings | null> {
  return Settings.findOne({})
}

export async function upsertSettings(payload: Partial<ISettings>): Promise<ISettings> {
  const existing = await Settings.findOne({})
  if (existing) {
    // Deep merge nested objects
    if (payload.businessInformation) {
      existing.businessInformation = {
        ...existing.businessInformation,
        ...payload.businessInformation,
      }
    }
    if (payload.companyAddress) {
      existing.companyAddress = {
        ...existing.companyAddress,
        ...payload.companyAddress,
      }
    }
    if (payload.taxInformation) {
      existing.taxInformation = {
        ...existing.taxInformation,
        ...payload.taxInformation,
      }
    }
    if (payload.themeColors) {
      existing.themeColors = {
        ...existing.themeColors,
        ...payload.themeColors,
      }
    }
    if (payload.emailSettings) {
      existing.emailSettings = {
        ...existing.emailSettings,
        ...payload.emailSettings,
      }
    }
    if (payload.notificationSettings) {
      existing.notificationSettings = {
        ...existing.notificationSettings,
        ...payload.notificationSettings,
      }
    }
    return existing.save()
  }
  return Settings.create(payload as any)
}


