import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { Request } from 'express'

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads')
const doDir = path.join(uploadsDir, 'DO')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
if (!fs.existsSync(doDir)) {
  fs.mkdirSync(doDir, { recursive: true })
}

// Configure storage for delivery order attachments
// Note: Directory structure will be handled in controller after fetching invoice number
const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    // Temporary directory - files will be moved to correct location in controller
    const tempDir = path.join(doDir, 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    cb(null, tempDir)
  },
  filename: (req: Request, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    cb(null, `${name}-${uniqueSuffix}${ext}`)
  },
})

// File filter - accept common document types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Invalid file type. Only PDF, images, and Office documents are allowed.'))
  }
}

export const uploadDeliveryOrder = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // Maximum 10 files
  },
})

// Ensure expenses directory exists
const expensesDir = path.join(uploadsDir, 'expenses')

if (!fs.existsSync(expensesDir)) {
  fs.mkdirSync(expensesDir, { recursive: true })
}

// Configure storage for expense attachments
// Note: Directory structure will be handled in controller after getting expense_id and date
const expenseStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    // Temporary directory - files will be moved to correct location in controller
    const tempDir = path.join(expensesDir, 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    cb(null, tempDir)
  },
  filename: (req: Request, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    cb(null, `${name}-${uniqueSuffix}${ext}`)
  },
})

export const uploadExpense = multer({
  storage: expenseStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // Maximum 10 files
  },
})

