import { Request, Response } from 'express'
import {
  createDeliveryOrder,
  deleteDeliveryOrder,
  getDeliveryOrderById,
  listDeliveryOrders,
  updateDeliveryOrder,
} from '../services/deliveryOrderService'
import { getSalesInvoiceById } from '../services/salesInvoiceService'
import { updateInventoryQty, getInventoryById } from '../services/inventoryService'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import crypto from 'crypto'
import { writableRoot } from '../utils/paths'

export const createDeliveryOrderEntry = async (req: Request, res: Response) => {
  try {
    const { serialNumber, invoiceNumber, date, customer, deliveryAddress, lineItems } = req.body

    // Parse lineItems if it's a JSON string (FormData sends it as string)
    let parsedLineItems: any[] = []
    if (lineItems) {
      if (typeof lineItems === 'string') {
        try {
          parsedLineItems = JSON.parse(lineItems)
        } catch (e) {
          console.error('Error parsing lineItems JSON:', e)
          parsedLineItems = []
        }
      } else if (Array.isArray(lineItems)) {
        parsedLineItems = lineItems
      }
    }

    // Fetch invoice to get invoice number string
    let invoiceNum = 'unknown'
    if (invoiceNumber) {
      const invoice = await getSalesInvoiceById(invoiceNumber)
      if (invoice) {
        invoiceNum = invoice.invoice_number
      }
    }

    const dateStr = date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    const targetDir = path.join(writableRoot, 'uploads', 'DO', `${invoiceNum}-${dateStr}`)
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // Handle multiple file uploads
    const attachmentPaths: string[] = []
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      // Multiple files
      for (const file of req.files as Express.Multer.File[]) {
        const fileName = file.filename
        const attachmentPath = path.join('uploads', 'DO', `${invoiceNum}-${dateStr}`, fileName).replace(/\\/g, '/')
        
        // Move file to correct directory if needed
        const correctFilePath = path.join(targetDir, fileName)
        if (file.path !== correctFilePath && fs.existsSync(file.path)) {
          fs.renameSync(file.path, correctFilePath)
        }
        
        attachmentPaths.push(attachmentPath)
      }
    } else if (req.file) {
      // Single file (backward compatibility)
      const fileName = req.file.filename
      const attachmentPath = path.join('uploads', 'DO', `${invoiceNum}-${dateStr}`, fileName).replace(/\\/g, '/')
      
      // Move file to correct directory if needed
      const correctFilePath = path.join(targetDir, fileName)
      if (req.file.path !== correctFilePath && fs.existsSync(req.file.path)) {
        fs.renameSync(req.file.path, correctFilePath)
      }
      
      attachmentPaths.push(attachmentPath)
    }

    const deliveryOrder = await createDeliveryOrder({
      serialNumber,
      invoiceNumber,
      date: new Date(date),
      customer,
      deliveryAddress,
      lineItems: parsedLineItems,
      attachments: attachmentPaths.length > 0 ? attachmentPaths : undefined,
      attachment: attachmentPaths.length === 1 ? attachmentPaths[0] : undefined, // Legacy support
    })

    res.status(201).json({ success: true, data: deliveryOrder })
  } catch (error: any) {
    // Clean up uploaded files if there was an error
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file: Express.Multer.File) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      })
    } else if (req.file) {
      const filePath = req.file.path
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getDeliveryOrders = async (req: Request, res: Response) => {
  try {
    const { q, invoiceNumber, customer, from, to } = req.query
    const orders = await listDeliveryOrders({
      q: q as string,
      invoiceNumber: invoiceNumber as string,
      customer: customer as string,
      from: from as string,
      to: to as string,
    })
    res.status(200).json({ success: true, data: orders, count: orders.length })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getDeliveryOrder = async (req: Request, res: Response) => {
  try {
    const order = await getDeliveryOrderById(req.params.id)
    if (!order) {
      return res.status(404).json({ success: false, message: 'Delivery order not found' })
    }
    res.status(200).json({ success: true, data: order })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateDeliveryOrderEntry = async (req: Request, res: Response) => {
  try {
    const { serialNumber, invoiceNumber, date, customer, deliveryAddress, lineItems } = req.body

    // Parse lineItems if it's a JSON string (FormData sends it as string)
    let parsedLineItems: any[] | undefined = undefined
    if (lineItems !== undefined) {
      if (typeof lineItems === 'string') {
        try {
          parsedLineItems = JSON.parse(lineItems)
        } catch (e) {
          console.error('Error parsing lineItems JSON:', e)
          parsedLineItems = []
        }
      } else if (Array.isArray(lineItems)) {
        parsedLineItems = lineItems
      }
    }

    // Get existing order first to use its invoice number if needed
    const existingOrder = await getDeliveryOrderById(req.params.id)
    if (!existingOrder) {
      // Clean up uploaded files if order not found
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach((file: Express.Multer.File) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path)
          }
        })
      } else if (req.file) {
        const filePath = req.file.path
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
      return res.status(404).json({ success: false, message: 'Delivery order not found' })
    }

    // Fetch invoice to get invoice number string
    let invoiceNum = 'unknown'
    let invoiceId: string | undefined = invoiceNumber
    
    if (!invoiceId && existingOrder.invoiceNumber) {
      if (typeof existingOrder.invoiceNumber === 'object' && existingOrder.invoiceNumber !== null) {
        // Populated SalesInvoice object
        invoiceId = (existingOrder.invoiceNumber as any)._id?.toString() || (existingOrder.invoiceNumber as any).id?.toString()
      } else {
        // ObjectId string
        invoiceId = String(existingOrder.invoiceNumber)
      }
    }
    
    if (invoiceId) {
      const invoice = await getSalesInvoiceById(invoiceId)
      if (invoice) {
        invoiceNum = invoice.invoice_number
      } else if (typeof existingOrder.invoiceNumber === 'object' && existingOrder.invoiceNumber !== null && 'invoice_number' in existingOrder.invoiceNumber) {
        // Populated SalesInvoice - use the invoice_number string field
        invoiceNum = (existingOrder.invoiceNumber as any).invoice_number
      }
    }

    const dateStr = date ? new Date(date).toISOString().split('T')[0] : (existingOrder.date ? new Date(existingOrder.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
    const targetDir = path.join(writableRoot, 'uploads', 'DO', `${invoiceNum}-${dateStr}`)
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    // Handle multiple file uploads
    const attachmentPaths: string[] = []
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      // Multiple files
      for (const file of req.files as Express.Multer.File[]) {
        const fileName = file.filename
        const attachmentPath = path.join('uploads', 'DO', `${invoiceNum}-${dateStr}`, fileName).replace(/\\/g, '/')
        
        // Move file to correct directory if needed
        const correctFilePath = path.join(targetDir, fileName)
        if (file.path !== correctFilePath && fs.existsSync(file.path)) {
          fs.renameSync(file.path, correctFilePath)
        }
        
        attachmentPaths.push(attachmentPath)
      }
    } else if (req.file) {
      // Single file (backward compatibility)
      const fileName = req.file.filename
      const attachmentPath = path.join('uploads', 'DO', `${invoiceNum}-${dateStr}`, fileName).replace(/\\/g, '/')
      
      // Move file to correct directory if needed
      const correctFilePath = path.join(targetDir, fileName)
      if (req.file.path !== correctFilePath && fs.existsSync(req.file.path)) {
        fs.renameSync(req.file.path, correctFilePath)
      }
      
      attachmentPaths.push(attachmentPath)
    }

    // Delete old attachments if new ones are uploaded
    if (attachmentPaths.length > 0) {
      const oldAttachments = existingOrder.attachments || (existingOrder.attachment ? [existingOrder.attachment] : [])
      oldAttachments.forEach((oldPath: string) => {
        const oldFilePath = path.join(writableRoot, oldPath)
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath)
        }
      })
    }

    const updates: any = {}
    if (serialNumber) updates.serialNumber = serialNumber
    if (invoiceNumber) updates.invoiceNumber = invoiceNumber
    if (date) updates.date = new Date(date)
    if (customer) updates.customer = customer
    if (deliveryAddress !== undefined) updates.deliveryAddress = deliveryAddress
    if (parsedLineItems !== undefined) updates.lineItems = parsedLineItems
    if (attachmentPaths.length > 0) {
      updates.attachments = attachmentPaths
      updates.attachment = attachmentPaths.length === 1 ? attachmentPaths[0] : undefined // Legacy support
    }

    const order = await updateDeliveryOrder(req.params.id, updates)
    res.status(200).json({ success: true, data: order })
  } catch (error: any) {
    // Clean up uploaded files if there was an error
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((file: Express.Multer.File) => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path)
        }
      })
    } else if (req.file) {
      const filePath = req.file.path
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteDeliveryOrderEntry = async (req: Request, res: Response) => {
  try {
    const order = await getDeliveryOrderById(req.params.id)
    if (!order) {
      return res.status(404).json({ success: false, message: 'Delivery order not found' })
    }

    // Get the sales invoice ID
    const invoiceId = typeof order.invoiceNumber === 'string' 
      ? order.invoiceNumber 
      : (order.invoiceNumber as any)?._id?.toString() || (order.invoiceNumber as any)?.id?.toString()

    // Check if sales invoice still exists
    const salesInvoice = invoiceId ? await getSalesInvoiceById(invoiceId) : null

    // Restore inventory quantities if delivery order was not delivered AND sales invoice doesn't exist
    // If sales invoice exists, don't restore (because sales invoice deletion will handle it)
    if (!salesInvoice && order.lineItems && order.lineItems.length > 0) {
      for (const lineItem of order.lineItems) {
        // Only restore if not delivered
        if (!lineItem.delivered) {
          const productId = typeof lineItem.product === 'string' 
            ? lineItem.product 
            : (lineItem.product as any)?._id?.toString() || (lineItem.product as any)?.id?.toString()
          
          if (!productId) continue

          const inventoryItem = await getInventoryById(productId)
          if (!inventoryItem) continue

          // Add back the quantity and normalize status from pending_delivery to normal
          if (inventoryItem.status === 'pending_delivery') {
            await updateInventoryQty(productId, lineItem.qty, 'normal')
          } else {
            await updateInventoryQty(productId, lineItem.qty)
          }
        }
      }
    }

    // Delete all attachment files if exist
    const attachments = order.attachments || (order.attachment ? [order.attachment] : [])
    attachments.forEach((attachmentPath: string) => {
      const filePath = path.join(writableRoot, attachmentPath)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    })

    await deleteDeliveryOrder(req.params.id)
    res.status(200).json({ success: true, message: 'Delivery order deleted successfully' })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Store for expiry links: { token: { orderId, expiresAt, zipPath } }
const expiryLinks = new Map<string, { orderId: string; expiresAt: number; zipPath: string }>()

// Cleanup expired links every hour
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of expiryLinks.entries()) {
    if (data.expiresAt < now) {
      // Delete zip file if exists
      if (fs.existsSync(data.zipPath)) {
        fs.unlinkSync(data.zipPath)
      }
      expiryLinks.delete(token)
    }
  }
}, 60 * 60 * 1000) // 1 hour

// Endpoint to download/view attachment (single file by index)
export const getDeliveryOrderAttachment = async (req: Request, res: Response) => {
  try {
    const order = await getDeliveryOrderById(req.params.id)
    if (!order) {
      return res.status(404).json({ success: false, message: 'Delivery order not found' })
    }

    const attachments = order.attachments || (order.attachment ? [order.attachment] : [])
    if (attachments.length === 0) {
      return res.status(404).json({ success: false, message: 'Attachment not found' })
    }

    // Get file index from query (default to 0)
    const index = parseInt(req.query.index as string) || 0
    if (index < 0 || index >= attachments.length) {
      return res.status(404).json({ success: false, message: 'Attachment index out of range' })
    }

    const filePath = path.join(writableRoot, attachments[index])
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found on server' })
    }

    res.sendFile(path.resolve(filePath))
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Endpoint to generate zip download link with expiry
export const generateZipDownloadLink = async (req: Request, res: Response) => {
  try {
    const order = await getDeliveryOrderById(req.params.id)
    if (!order) {
      return res.status(404).json({ success: false, message: 'Delivery order not found' })
    }

    const attachments = order.attachments || (order.attachment ? [order.attachment] : [])
    if (attachments.length === 0) {
      return res.status(404).json({ success: false, message: 'No attachments found' })
    }

    if (attachments.length === 1) {
      // If only one file, return direct download link
      const filePath = path.join(writableRoot, attachments[0])
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found on server' })
      }
      return res.json({
        success: true,
        data: {
          downloadUrl: `/api/delivery-orders/${req.params.id}/attachment?index=0`,
          expiresAt: null, // No expiry for single file
        },
      })
    }

    // Create zip file
    const zipFileName = `delivery-order-${order.serialNumber}-${Date.now()}.zip`
    const zipPath = path.join(writableRoot, 'uploads', 'temp', zipFileName)
    const zipDir = path.dirname(zipPath)
    
    // Ensure temp directory exists
    if (!fs.existsSync(zipDir)) {
      fs.mkdirSync(zipDir, { recursive: true })
    }

    // Create zip archive
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise<void>((resolve, reject) => {
      output.on('close', () => {
        // Generate expiry token
        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        
        expiryLinks.set(token, { orderId: req.params.id, expiresAt, zipPath })

        res.json({
          success: true,
          data: {
            downloadUrl: `/api/delivery-orders/download-zip/${token}`,
            expiresAt: new Date(expiresAt).toISOString(),
            token,
          },
        })
        resolve()
      })

      archive.on('error', (err) => {
        reject(err)
      })

      archive.pipe(output)

      // Add files to zip
      attachments.forEach((attachmentPath: string, index: number) => {
        const filePath = path.join(writableRoot, attachmentPath)
        if (fs.existsSync(filePath)) {
          const fileName = path.basename(attachmentPath)
          archive.file(filePath, { name: fileName })
        }
      })

      archive.finalize()
    }).catch((error: any) => {
      // Clean up zip file on error
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath)
      }
      res.status(500).json({ success: false, message: error.message || 'Failed to create zip file' })
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Endpoint to download zip file using expiry token
export const downloadZipFile = async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const linkData = expiryLinks.get(token)

    if (!linkData) {
      return res.status(404).json({ success: false, message: 'Download link not found or expired' })
    }

    if (Date.now() > linkData.expiresAt) {
      // Link expired, clean up
      if (fs.existsSync(linkData.zipPath)) {
        fs.unlinkSync(linkData.zipPath)
      }
      expiryLinks.delete(token)
      return res.status(410).json({ success: false, message: 'Download link has expired' })
    }

    if (!fs.existsSync(linkData.zipPath)) {
      expiryLinks.delete(token)
      return res.status(404).json({ success: false, message: 'Zip file not found' })
    }

    // Send zip file
    res.download(linkData.zipPath, (err) => {
      if (err) {
        console.error('Error downloading zip:', err)
      }
      // Optionally delete zip file after download (uncomment if needed)
      // if (fs.existsSync(linkData.zipPath)) {
      //   fs.unlinkSync(linkData.zipPath)
      // }
      // expiryLinks.delete(token)
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

