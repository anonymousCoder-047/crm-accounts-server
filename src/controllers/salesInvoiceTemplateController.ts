import { Request, Response } from 'express'
import {
  createTemplate,
  listTemplates,
  getTemplateById,
  getDefaultTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate as setDefaultTemplateService,
} from '../services/salesInvoiceTemplateService'
import { AuthRequest } from '../middleware/auth'

export const createInvoiceTemplate = async (req: AuthRequest, res: Response) => {
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

    console.log('📦 Creating template with design:', body.design ? 'Present' : 'Missing')
    const template = await createTemplate({
      ...body,
      createdBy: req.user?.id,
    })
    console.log('✅ Template created, design in response:', template?.design ? 'Present' : 'Missing')

    res.status(201).json({
      success: true,
      data: template,
    })
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Template name already exists',
      })
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create template',
    })
  }
}

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await listTemplates()

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch templates',
    })
  }
}

export const getTemplate = async (req: Request, res: Response) => {
  try {
    const template = await getTemplateById(req.params.id)

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      })
    }

    res.json({
      success: true,
      data: template,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch template',
    })
  }
}

export const getDefaultInvoiceTemplate = async (req: Request, res: Response) => {
  try {
    const template = await getDefaultTemplate()

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No default template found',
      })
    }

    res.json({
      success: true,
      data: template,
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch default template',
    })
  }
}

export const updateInvoiceTemplate = async (req: AuthRequest, res: Response) => {
  try {
    // Parse FormData fields
    const body: any = { ...req.body }
    
    // Handle logo file upload
    if (req.file) {
      // Convert buffer to base64
      body.logo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    } else if (body.logo && typeof body.logo === 'string' && body.logo.startsWith('data:')) {
      // Keep existing logo if it's already a base64 string
      body.logo = body.logo
    } else {
      // Don't update logo if no new file provided
      delete body.logo
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
    const template = await updateTemplate(req.params.id, {
      ...body,
      updatedBy: req.user?.id,
    })
    console.log('✅ Template updated, design in response:', template?.design ? 'Present' : 'Missing')

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      })
    }

    res.json({
      success: true,
      data: template,
    })
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Template name already exists',
      })
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update template',
    })
  }
}

export const deleteInvoiceTemplate = async (req: Request, res: Response) => {
  try {
    const deleted = await deleteTemplate(req.params.id)

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      })
    }

    res.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete template',
    })
  }
}

export const setDefaultTemplate = async (req: Request, res: Response) => {
  try {
    const template = await setDefaultTemplateService(req.params.id)

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      })
    }

    res.json({
      success: true,
      data: template,
      message: 'Default template updated successfully',
    })
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to set default template',
    })
  }
}

