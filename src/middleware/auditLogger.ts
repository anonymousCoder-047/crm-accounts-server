import { Request, Response, NextFunction } from 'express'
import { logAPI } from '../utils/logger'
import { AuthRequest } from './auth'

// Middleware to log API calls
export const auditLogger = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()

  // Capture response data
  const originalSend = res.send
  let responseBody: any

  res.send = function (body: any) {
    responseBody = body
    return originalSend.call(this, body)
  }

  // Wait for response to finish
  res.on('finish', async () => {
    const responseTime = Date.now() - startTime
    const authReq = req as AuthRequest

    // Extract user info
    const userId = authReq.user?.id
    const userEmail = authReq.user?.email

    // Extract request info
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    // Get request body (exclude sensitive fields)
    let requestBody = req.body
    if (requestBody) {
      // Remove sensitive fields
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization']
      requestBody = { ...requestBody }
      sensitiveFields.forEach((field) => {
        if (requestBody[field]) {
          requestBody[field] = '[REDACTED]'
        }
      })
    }

    // Check if there was an error
    let error: Error | undefined
    try {
      const parsedBody = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody
      if (parsedBody && parsedBody.success === false) {
        error = new Error(parsedBody.message || 'Request failed')
      }
    } catch {
      // Ignore parsing errors
    }

    // Log the API call
    await logAPI(
      req.method,
      req.path || req.url,
      res.statusCode,
      responseTime,
      userId,
      userEmail,
      Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent,
      requestBody,
      error
    )
  })

  next()
}

