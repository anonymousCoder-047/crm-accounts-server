import { Request, Response } from 'express'
import {
  createExpense,
  deleteExpense,
  getExpenseById,
  listExpenses,
  updateExpense,
} from '../services/expenseService'
import { getJournalEntriesByReference, deleteJournalEntry, createJournalEntry } from '../services/journalEntryService'
import { getAccountByAccountId } from '../services/accountService'
import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import crypto from 'crypto'
import { writableRoot } from '../utils/paths'

// Store expiry links for zip downloads (token -> { expenseId, expiresAt, zipPath })
const expiryLinks = new Map<string, { expenseId: string; expiresAt: number; zipPath: string }>()

// Clean up expired links periodically (every hour)
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of expiryLinks.entries()) {
    if (now > data.expiresAt) {
      if (fs.existsSync(data.zipPath)) {
        fs.unlinkSync(data.zipPath)
      }
      expiryLinks.delete(token)
    }
  }
}, 60 * 60 * 1000) // 1 hour

export const createExpenseEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' })
    }
    
    const { expense_id, expense_date } = req.body
    
    // Create folder structure: uploads/expenses/Expense ID - <date>/
    const dateStr = expense_date 
      ? new Date(expense_date).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0]
    const expenseId = expense_id || `EXP-${Date.now()}`
    const folderName = `${expenseId} - ${dateStr}`
    const targetDir = path.join(writableRoot, 'uploads', 'expenses', folderName)
    
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
        const attachmentPath = path.join('uploads', 'expenses', folderName, fileName).replace(/\\/g, '/')
        
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
      const attachmentPath = path.join('uploads', 'expenses', folderName, fileName).replace(/\\/g, '/')
      
      // Move file to correct directory if needed
      const correctFilePath = path.join(targetDir, fileName)
      if (req.file.path !== correctFilePath && fs.existsSync(req.file.path)) {
        fs.renameSync(req.file.path, correctFilePath)
      }
      
      attachmentPaths.push(attachmentPath)
    }

    // Parse FormData fields (multer puts them in req.body as strings)
    const expenseData = {
      expense_id: req.body.expense_id,
      category: req.body.category,
      vendor_id: req.body.vendor_id || undefined,
      amount: Number(req.body.amount) || 0,
      currency: req.body.currency || 'AED',
      expense_date: req.body.expense_date,
      payment_method: req.body.payment_method || undefined,
      reference_number: req.body.reference_number || undefined,
      tax_amount: Number(req.body.tax_amount) || 0,
      description: req.body.description || undefined,
      attachments: attachmentPaths.length > 0 ? attachmentPaths : (req.body.attachments ? (typeof req.body.attachments === 'string' ? JSON.parse(req.body.attachments) : req.body.attachments) : []),
      associated_account: req.body.associated_account,
      status: req.body.status || 'paid',
    }
    
    const exp = await createExpense(expenseData, userId)
    res.status(201).json({ success: true, data: exp })
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

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const items = await listExpenses({
      q: req.query.q as string,
      category: req.query.category as string,
      vendor_id: req.query.vendor_id as string,
      status: req.query.status as string,
      from: req.query.from as string,
      to: req.query.to as string,
    })
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getExpense = async (req: Request, res: Response) => {
  try {
    const exp = await getExpenseById(req.params.id)
    if (!exp) return res.status(404).json({ success: false, message: 'Expense not found' })
    res.json({ success: true, data: exp })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateExpenseEntry = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    
    // Get existing expense to get expense_id and date
    const existingExpense = await getExpenseById(req.params.id)
    if (!existingExpense) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }

    const expenseId = existingExpense.expense_id
    const dateStr = existingExpense.expense_date 
      ? new Date(existingExpense.expense_date).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0]
    const folderName = `${expenseId} - ${dateStr}`
    const targetDir = path.join(writableRoot, 'uploads', 'expenses', folderName)
    
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
        const attachmentPath = path.join('uploads', 'expenses', folderName, fileName).replace(/\\/g, '/')
        
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
      const attachmentPath = path.join('uploads', 'expenses', folderName, fileName).replace(/\\/g, '/')
      
      // Move file to correct directory if needed
      const correctFilePath = path.join(targetDir, fileName)
      if (req.file.path !== correctFilePath && fs.existsSync(req.file.path)) {
        fs.renameSync(req.file.path, correctFilePath)
      }
      
      attachmentPaths.push(attachmentPath)
    }

    // Delete old attachments if new ones are uploaded
    if (attachmentPaths.length > 0 && existingExpense.attachments) {
      existingExpense.attachments.forEach((oldPath: string) => {
        const oldFilePath = path.join(writableRoot, oldPath)
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath)
        }
      })
    }

    // Prepare update data - parse FormData fields
    const updates: any = {}
    if (req.body.expense_id !== undefined) updates.expense_id = req.body.expense_id
    if (req.body.category !== undefined) updates.category = req.body.category
    if (req.body.vendor_id !== undefined) updates.vendor_id = req.body.vendor_id || undefined
    if (req.body.amount !== undefined) updates.amount = Number(req.body.amount)
    if (req.body.currency !== undefined) updates.currency = req.body.currency
    if (req.body.expense_date !== undefined) updates.expense_date = req.body.expense_date
    if (req.body.payment_method !== undefined) updates.payment_method = req.body.payment_method || undefined
    if (req.body.reference_number !== undefined) updates.reference_number = req.body.reference_number || undefined
    if (req.body.tax_amount !== undefined) updates.tax_amount = Number(req.body.tax_amount)
    if (req.body.description !== undefined) updates.description = req.body.description || undefined
    if (req.body.associated_account !== undefined) updates.associated_account = req.body.associated_account
    if (req.body.status !== undefined) updates.status = req.body.status
    
    // Only update attachments if new files were uploaded
    // If no new files are uploaded, preserve existing attachments (don't update the field)
    if (attachmentPaths.length > 0) {
      // New files uploaded - replace all attachments with new ones
      updates.attachments = attachmentPaths
    }
    // If no new files and attachments field is not sent, existing attachments are preserved automatically

    // Get expense ID as string for journal entry lookup
    const expenseIdStr = typeof existingExpense._id === 'string' 
      ? existingExpense._id 
      : (existingExpense._id as any)?.toString()

    // Find and delete all related journal entries before updating
    if (expenseIdStr && userId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Expense', expenseIdStr)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'expense',
          reference: existingExpense.expense_id,
        }).exec()

        // Combine and deduplicate journal entries
        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesBySource.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for expense update:', journalError)
        // Continue with expense update even if journal entry deletion fails
      }
    }

    const exp = await updateExpense(req.params.id, updates, userId)
    if (!exp) return res.status(404).json({ success: false, message: 'Expense not found' })

    // Recreate journal entries based on updated expense data
    if (userId) {
      try {
        const totalAmount = (exp.amount || 0) + (exp.tax_amount || 0)
        const isUnpaid = exp.status?.toLowerCase() === 'unpaid'

        if (!isUnpaid) {
          // Paid expense: Debit Expense Account, Credit Cash/Bank
          let expenseAccountId = exp.associated_account || 'EXPENSE'
          let expenseAccountName = exp.category || 'Expense'
          
          // If it looks like an account_id (contains dashes), look up the account
          if (expenseAccountId.includes('-') && expenseAccountId.length > 10) {
            const account = await getAccountByAccountId(expenseAccountId)
            if (account) {
              expenseAccountId = account.account_id
              expenseAccountName = account.account_name
            } else {
              expenseAccountName = exp.category || expenseAccountId
            }
          } else {
            // It's an account name, convert to account_id format
            expenseAccountId = expenseAccountId.toUpperCase().replace(/\s+/g, '_')
            expenseAccountName = exp.associated_account || exp.category || 'Expense'
          }
          
          const paymentAccountId = exp.payment_method === 'bank' ? 'BANK' : 'CASH'
          
          await createJournalEntry({
            date: exp.expense_date ? new Date(exp.expense_date) : new Date(),
            reference: exp.expense_id,
            description: `Expense: ${expenseAccountName} (${exp.expense_id})`,
            entries: [
              {
                account_id: expenseAccountId,
                account_name: expenseAccountName,
                debit: totalAmount,
                credit: 0,
              },
              {
                account_id: paymentAccountId,
                account_name: exp.payment_method === 'bank' ? 'Bank' : 'Cash',
                debit: 0,
                credit: totalAmount,
              },
            ],
            createdBy: userId,
            source_module: 'expense',
            referenceType: 'Expense',
            referenceId: String(exp._id),
          })
        }
        // Note: Unpaid expenses create payables which handle their own journal entries
      } catch (journalError: any) {
        console.error('Error recreating journal entries for expense update:', journalError)
        // Continue even if journal entry recreation fails
      }
    }

    res.json({ success: true, data: exp })
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

export const updateExpenseStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    const { status } = req.body as { status: 'paid' | 'unpaid' }
    if (!status || !['paid', 'unpaid'].includes(status.toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Status must be "paid" or "unpaid"' })
    }
    const normalizedStatus = status.toLowerCase() as 'paid' | 'unpaid'

    const existingExpense = await getExpenseById(req.params.id)
    if (!existingExpense) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }

    const expenseIdStr = typeof existingExpense._id === 'string'
      ? existingExpense._id
      : (existingExpense._id as any)?.toString()

    // Delete old journal entries
    if (expenseIdStr && userId) {
      try {
        const journalEntriesByRef = await getJournalEntriesByReference('Expense', expenseIdStr)
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'expense',
          reference: existingExpense.expense_id,
        }).exec()

        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesBySource.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for status update:', journalError)
      }
    }

    const exp = await updateExpense(req.params.id, { status: normalizedStatus }, userId)
    if (!exp) return res.status(404).json({ success: false, message: 'Expense not found' })

    // Recreate journal entries when paid
    if (userId && normalizedStatus === 'paid') {
      try {
        const totalAmount = (exp.amount || 0) + (exp.tax_amount || 0)
        let expenseAccountId = exp.associated_account || 'EXPENSE'
        let expenseAccountName = exp.category || 'Expense'
        if (expenseAccountId.includes('-') && expenseAccountId.length > 10) {
          const account = await getAccountByAccountId(expenseAccountId)
          if (account) {
            expenseAccountId = account.account_id
            expenseAccountName = account.account_name
          }
        } else {
          expenseAccountId = expenseAccountId.toUpperCase().replace(/\s+/g, '_')
          expenseAccountName = exp.associated_account || exp.category || 'Expense'
        }
        const paymentAccountId = exp.payment_method === 'bank' ? 'BANK' : 'CASH'
        await createJournalEntry({
          date: exp.expense_date ? new Date(exp.expense_date) : new Date(),
          reference: exp.expense_id,
          description: `Expense: ${expenseAccountName} (${exp.expense_id})`,
          entries: [
            { account_id: expenseAccountId, account_name: expenseAccountName, debit: totalAmount, credit: 0 },
            { account_id: paymentAccountId, account_name: exp.payment_method === 'bank' ? 'Bank' : 'Cash', debit: 0, credit: totalAmount },
          ],
          createdBy: userId,
          source_module: 'expense',
          referenceType: 'Expense',
          referenceId: String(exp._id),
        })
      } catch (journalError: any) {
        console.error('Error recreating journal entries for status update:', journalError)
      }
    }

    res.json({ success: true, data: exp })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const deleteExpenseEntry = async (req: Request, res: Response) => {
  try {
    // Get expense before deleting to clean up attachments
    const expense = await getExpenseById(req.params.id)
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }

    // Get expense ID as string
    const expenseId = typeof expense._id === 'string' 
      ? expense._id 
      : (expense._id as any)?.toString()

    // Find and delete all related journal entries
    // Journal entries are linked via referenceType: 'Expense' and referenceId: expense._id
    // or via source_module: 'expense' and reference: expense.expense_id
    if (expenseId) {
      try {
        // Find journal entries by referenceType and referenceId (legacy fields)
        const journalEntriesByRef = await getJournalEntriesByReference('Expense', expenseId)
        
        // Also find by source_module and reference
        const JournalEntry = (await import('../models/JournalEntry')).default
        const journalEntriesBySource = await JournalEntry.find({
          source_module: 'expense',
          reference: expense.expense_id,
        }).exec()

        // Combine and deduplicate journal entries
        const allJournalEntries = new Map()
        journalEntriesByRef.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })
        journalEntriesBySource.forEach(entry => {
          allJournalEntries.set(String(entry._id), entry)
        })

        // Delete all journal entries (this will also delete their GL entries)
        for (const journalEntry of allJournalEntries.values()) {
          await deleteJournalEntry(String(journalEntry._id))
        }
      } catch (journalError: any) {
        console.error('Error deleting journal entries for expense:', journalError)
        // Continue with expense deletion even if journal entry deletion fails
      }
    }

    // Delete attachment files
    if (expense.attachments && expense.attachments.length > 0) {
      expense.attachments.forEach((attachmentPath: string) => {
        const filePath = path.join(writableRoot, attachmentPath)
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      })
      
      // Try to remove the expense folder if it's empty
      const expenseIdStr = expense.expense_id
      const dateStr = expense.expense_date 
        ? new Date(expense.expense_date).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0]
      const folderName = `${expenseIdStr} - ${dateStr}`
      const expenseDir = path.join(writableRoot, 'uploads', 'expenses', folderName)
      if (fs.existsSync(expenseDir)) {
        try {
          const files = fs.readdirSync(expenseDir)
          if (files.length === 0) {
            fs.rmdirSync(expenseDir)
          }
        } catch (err) {
          // Ignore errors when removing directory
        }
      }
    }

    const exp = await deleteExpense(req.params.id)
    res.json({ success: true, data: exp })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getExpenseAttachment = async (req: Request, res: Response) => {
  try {
    const expense = await getExpenseById(req.params.id)
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }

    const attachments = expense.attachments || []
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
    const expense = await getExpenseById(req.params.id)
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }

    const attachments = expense.attachments || []
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
          downloadUrl: `/api/expenses/${req.params.id}/attachment?index=0`,
          expiresAt: null, // No expiry for single file
        },
      })
    }

    // Create zip file
    const zipFileName = `expense-${expense.expense_id}-${Date.now()}.zip`
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
        
        expiryLinks.set(token, { expenseId: req.params.id, expiresAt, zipPath })

        res.json({
          success: true,
          data: {
            downloadUrl: `/api/expenses/download-zip/${token}`,
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


