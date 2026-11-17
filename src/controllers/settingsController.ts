import { Request, Response } from 'express'
import { getSettings, upsertSettings } from '../services/settingsService'

// @desc    Get application settings
// @route   GET /api/settings
// @access  Protected (admin/manager/superadmin recommended)
export const getAppSettings = async (req: Request, res: Response) => {
  try {
    const settings = await getSettings()
    res.json({ success: true, data: settings })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// @desc    Update application settings (upsert)
// @route   PUT /api/settings
// @access  Admin/superadmin
export const updateAppSettings = async (req: Request, res: Response) => {
  try {
    const updated = await upsertSettings(req.body)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


