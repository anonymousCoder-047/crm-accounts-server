import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import {
  createPurchaseTemplate,
  listPurchaseTemplates,
  getPurchaseTemplateById,
  getDefaultPurchaseTemplate,
  updatePurchaseTemplate,
  deletePurchaseTemplate,
  setDefaultPurchaseTemplate,
} from '../services/purchaseInvoiceTemplateService'

export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    // Parse FormData fields
    const body: any = { ...req.body }
    
    // Parse JSON fields if they are strings (from FormData)
    if (typeof body.layout === 'string') {
      try {
        body.layout = JSON.parse(body.layout)
      } catch (e) {
        body.layout = {}
      }
    }
    if (typeof body.styling === 'string') {
      try {
        body.styling = JSON.parse(body.styling)
      } catch (e) {
        body.styling = {}
      }
    }
    if (typeof body.fieldsVisibility === 'string') {
      try {
        body.fieldsVisibility = JSON.parse(body.fieldsVisibility)
      } catch (e) {
        body.fieldsVisibility = {}
      }
    }
    if (typeof body.customFields === 'string') {
      try {
        body.customFields = JSON.parse(body.customFields)
      } catch (e) {
        body.customFields = []
      }
    }
    if (typeof body.design === 'string') {
      try {
        body.design = JSON.parse(body.design)
        console.log('✅ Parsed design field (create):', JSON.stringify(body.design).substring(0, 200))
      } catch (e) {
        console.error('❌ Failed to parse design field (create):', e)
        body.design = undefined
      }
    }
    
    // Handle boolean fields
    if (typeof body.isDefault === 'string') {
      body.isDefault = body.isDefault === 'true'
    }
    
    // Handle logo file upload
    if (req.file) {
      body.logo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    }

    console.log('📦 Creating template with design:', body.design ? 'Present' : 'Missing')
    const tpl = await createPurchaseTemplate({ ...body, createdBy: req.user?.id as any })
    console.log('✅ Template created, design in response:', tpl?.design ? 'Present' : 'Missing')
    res.status(201).json({ success: true, data: tpl })
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Template name already exists' })
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const tpls = await listPurchaseTemplates()
    res.json({ success: true, data: tpls, count: tpls.length })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getTemplate = async (req: Request, res: Response) => {
  try {
    const tpl = await getPurchaseTemplateById(req.params.id)
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, data: tpl })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getDefaultTemplate = async (req: Request, res: Response) => {
  try {
    const tpl = await getDefaultPurchaseTemplate()
    if (!tpl) return res.status(404).json({ success: false, message: 'No default template found' })
    res.json({ success: true, data: tpl })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const body: any = { ...req.body }
    
    // Handle logo file upload
    if (req.file) {
      body.logo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    } else if (body.logo && typeof body.logo === 'string' && body.logo.startsWith('data:')) {
      body.logo = body.logo // Keep existing base64 logo
    } else {
      delete body.logo // Don't update logo if no new file provided
    }
    
    // Parse JSON fields if they are strings (from FormData)
    if (typeof body.layout === 'string') {
      try {
        body.layout = JSON.parse(body.layout)
      } catch (e) {
        body.layout = undefined
      }
    }
    if (typeof body.styling === 'string') {
      try {
        body.styling = JSON.parse(body.styling)
      } catch (e) {
        body.styling = undefined
      }
    }
    if (typeof body.fieldsVisibility === 'string') {
      try {
        body.fieldsVisibility = JSON.parse(body.fieldsVisibility)
      } catch (e) {
        body.fieldsVisibility = undefined
      }
    }
    if (typeof body.customFields === 'string') {
      try {
        body.customFields = JSON.parse(body.customFields)
      } catch (e) {
        body.customFields = undefined
      }
    }
    if (typeof body.design === 'string') {
      try {
        body.design = JSON.parse(body.design)
        console.log('✅ Parsed design field:', JSON.stringify(body.design).substring(0, 200))
      } catch (e) {
        console.error('❌ Failed to parse design field:', e)
        body.design = undefined
      }
    }
    
    // Handle boolean fields
    if (typeof body.isDefault === 'string') {
      body.isDefault = body.isDefault === 'true'
    }
    
    console.log('📦 Updating template with design:', body.design ? 'Present' : 'Missing')
    const tpl = await updatePurchaseTemplate(req.params.id, { ...body, updatedBy: req.user?.id as any })
    console.log('✅ Template updated, design in response:', tpl?.design ? 'Present' : 'Missing')
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, data: tpl })
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Template name already exists' })
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const ok = await deletePurchaseTemplate(req.params.id)
    if (!ok) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, message: 'Template deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const setDefault = async (req: Request, res: Response) => {
  try {
    const tpl = await setDefaultPurchaseTemplate(req.params.id)
    if (!tpl) return res.status(404).json({ success: false, message: 'Template not found' })
    res.json({ success: true, data: tpl, message: 'Default template updated successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}


