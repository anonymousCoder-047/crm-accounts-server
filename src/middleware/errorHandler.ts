import { Request, Response, NextFunction } from 'express'
import { logAppError, logServerError, logDBError } from '../utils/logger'
import mongoose from 'mongoose'

export interface AppError extends Error {
  statusCode?: number
  code?: string
  isOperational?: boolean
}

// Custom error class
export class CustomError extends Error implements AppError {
  statusCode: number
  code?: string
  isOperational: boolean

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

// Handle MongoDB errors
function handleMongoError(error: any): AppError {
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message).join(', ')
    return new CustomError(messages, 400, 'VALIDATION_ERROR')
  }

  if (error.name === 'CastError') {
    return new CustomError(`Invalid ${error.path}: ${error.value}`, 400, 'CAST_ERROR')
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0]
    return new CustomError(`${field} already exists`, 409, 'DUPLICATE_ERROR')
  }

  if (error.name === 'MongoServerError') {
    return new CustomError('Database server error', 500, 'MONGO_SERVER_ERROR')
  }

  return new CustomError('Database error', 500, 'DB_ERROR')
}

// Handle JWT errors
function handleJWTError(error: any): AppError {
  if (error.name === 'JsonWebTokenError') {
    return new CustomError('Invalid token', 401, 'JWT_ERROR')
  }

  if (error.name === 'TokenExpiredError') {
    return new CustomError('Token expired', 401, 'JWT_EXPIRED')
  }

  return new CustomError('Authentication error', 401, 'AUTH_ERROR')
}

// Main error handler middleware
export const errorHandler = async (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err } as AppError
  error.message = err.message

  // Log original error
  console.error('Error:', err)

  // Handle specific error types
  if (err instanceof mongoose.Error) {
    error = handleMongoError(err)
    await logDBError(
      error.message,
      err,
      {
        operation: 'unknown',
        collection: 'unknown',
        query: err,
      }
    )
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err)
    await logAppError(error.message, err, { type: 'JWT_ERROR' })
  } else if (err.name === 'ValidationError') {
    error = new CustomError(err.message, 400, 'VALIDATION_ERROR')
    await logAppError(error.message, err, { type: 'VALIDATION_ERROR' })
  } else if (!error.statusCode) {
    // Unknown server error
    error.statusCode = 500
    error.code = 'SERVER_ERROR'
    await logServerError(error.message, err, {
      path: req.path,
      method: req.method,
      body: req.body,
    })
  } else {
    // Known application error
    await logAppError(error.message, err, {
      statusCode: error.statusCode,
      code: error.code,
      path: req.path,
      method: req.method,
    })
  }

  // Send error response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}

// Async handler wrapper to catch errors in async routes
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

