import fs from 'fs'
import path from 'path'
import AuditTrail, { LogType, ErrorType } from '../models/AuditTrail'

// Base logs directory
const logsDir = path.join(process.cwd(), 'logs')

// Subdirectories for different error types
const errorDirs: Record<string, string> = {
  'app-error': path.join(logsDir, 'app-errors'),
  'server-error': path.join(logsDir, 'server-errors'),
  'db-error': path.join(logsDir, 'db-errors'),
  'api': path.join(logsDir, 'api'),
  'info': path.join(logsDir, 'info'),
}

// Ensure all directories exist
Object.values(errorDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

// Get date string in YYYY-MM-DD format
function getDateString(): string {
  return new Date().toISOString().split('T')[0]
}

// Get formatted timestamp
function getTimestamp(): string {
  return new Date().toISOString()
}

// Get file path for a specific error type and date
function getLogFilePath(errorType: ErrorType | 'api' | 'info', date?: string): string {
  const dateStr = date || getDateString()
  const dir = errorDirs[errorType] || logsDir
  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, `${errorType}-${dateStr}.log`)
}

// Write to log file
function writeToFile(filePath: string, message: string): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Append to file
    fs.appendFileSync(filePath, message + '\n', 'utf8')
  } catch (error) {
    console.error('Failed to write to log file:', error)
  }
}

// Format log entry
function formatLogEntry(level: string, message: string, data?: any): string {
  const timestamp = getTimestamp()
  const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : ''
  return `[${timestamp}] [${level}] ${message}${dataStr}`
}

// Log to file and optionally to database
export async function logToFile(
  errorType: ErrorType | 'api' | 'info',
  level: string,
  message: string,
  data?: any,
  saveToDB = false
): Promise<void> {
  const filePath = getLogFilePath(errorType)
  const logEntry = formatLogEntry(level, message, data)
  writeToFile(filePath, logEntry)

  // Optionally save to database
  if (saveToDB) {
    try {
      await AuditTrail.create({
        type: errorType === 'api' ? 'api' : errorType === 'info' ? 'info' : 'error',
        errorType: errorType.includes('error') ? (errorType as ErrorType) : undefined,
        action: message,
        error: errorType.includes('error')
          ? {
              message,
              details: data,
            }
          : undefined,
        metadata: data,
      })
    } catch (dbError) {
      console.error('Failed to save log to database:', dbError)
    }
  }
}

// Log application errors
export async function logAppError(
  message: string,
  error?: Error | any,
  metadata?: Record<string, any>,
  saveToDB = true
): Promise<void> {
  const errorData = {
    message: error?.message || message,
    stack: error?.stack,
    code: error?.code,
    ...metadata,
  }
  await logToFile('app-error', 'ERROR', message, errorData, saveToDB)
}

// Log server errors
export async function logServerError(
  message: string,
  error?: Error | any,
  metadata?: Record<string, any>,
  saveToDB = true
): Promise<void> {
  const errorData = {
    message: error?.message || message,
    stack: error?.stack,
    code: error?.code,
    statusCode: error?.statusCode,
    ...metadata,
  }
  await logToFile('server-error', 'ERROR', message, errorData, saveToDB)
}

// Log database errors
export async function logDBError(
  message: string,
  error?: Error | any,
  metadata?: Record<string, any>,
  saveToDB = true
): Promise<void> {
  const errorData = {
    message: error?.message || message,
    stack: error?.stack,
    code: error?.code,
    operation: metadata?.operation,
    collection: metadata?.collection,
    query: metadata?.query,
    ...metadata,
  }
  await logToFile('db-error', 'ERROR', message, errorData, saveToDB)
}

// Log API calls
export async function logAPI(
  method: string,
  path: string,
  statusCode: number,
  responseTime: number,
  userId?: string,
  userEmail?: string,
  ipAddress?: string,
  userAgent?: string,
  requestBody?: any,
  error?: Error | any,
  saveToDB = true
): Promise<void> {
  const logData = {
    method,
    path,
    statusCode,
    responseTime,
    userId,
    userEmail,
    ipAddress,
    userAgent,
    requestBody: requestBody ? JSON.stringify(requestBody).substring(0, 1000) : undefined, // Limit size
    error: error
      ? {
          message: error.message,
          stack: error.stack,
          code: error.code,
        }
      : undefined,
  }

  const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO'
  const message = `${method} ${path} - ${statusCode} (${responseTime}ms)`

  await logToFile('api', level, message, logData, saveToDB)

  // Also save to database
  if (saveToDB) {
    try {
      await AuditTrail.create({
        type: 'api',
        action: `${method} ${path}`,
        method,
        path,
        userId: userId ? (userId as any) : undefined,
        userEmail,
        ipAddress,
        userAgent,
        requestBody: requestBody ? JSON.stringify(requestBody).substring(0, 5000) : undefined,
        responseStatus: statusCode,
        responseTime,
        error: error
          ? {
              message: error.message,
              stack: error.stack,
              code: error.code,
            }
          : undefined,
      })
    } catch (dbError) {
      console.error('Failed to save API log to database:', dbError)
    }
  }
}

// Log database operations
export async function logDBOperation(
  operation: string,
  collection: string,
  query?: any,
  error?: Error | any,
  saveToDB = true
): Promise<void> {
  const logData = {
    operation,
    collection,
    query: query ? JSON.stringify(query).substring(0, 1000) : undefined,
    error: error
      ? {
          message: error.message,
          stack: error.stack,
          code: error.code,
        }
      : undefined,
  }

  const level = error ? 'ERROR' : 'INFO'
  const message = `DB ${operation.toUpperCase()} on ${collection}`

  if (error) {
    await logDBError(message, error, logData, saveToDB)
  } else {
    await logToFile('info', level, message, logData, saveToDB)
  }

  // Also save to database
  if (saveToDB) {
    try {
      await AuditTrail.create({
        type: 'db',
        action: `${operation} ${collection}`,
        dbOperation: operation,
        dbCollection: collection,
        dbQuery: query,
        dbError: error
          ? {
              message: error.message,
              code: error.code,
              details: error,
            }
          : undefined,
      })
    } catch (dbError) {
      console.error('Failed to save DB log to database:', dbError)
    }
  }
}

// Log general info
export async function logInfo(message: string, data?: any, saveToDB = false): Promise<void> {
  await logToFile('info', 'INFO', message, data, saveToDB)
}

// Log warnings
export async function logWarning(message: string, data?: any, saveToDB = false): Promise<void> {
  await logToFile('info', 'WARN', message, data, saveToDB)
}

