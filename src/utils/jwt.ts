import jwt, { SignOptions } from 'jsonwebtoken'
import crypto from 'crypto'
import { encryptTokenData, decryptTokenData } from './encryption'

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRE: string = process.env.JWT_EXPIRE || '7d'
const JWT_ISSUER: string | undefined = process.env.JWT_ISSUER || 'crm-accounts'
const JWT_AUDIENCE: string | undefined = process.env.JWT_AUDIENCE || undefined
const JWT_ALGORITHM: jwt.Algorithm = (process.env.JWT_ALGORITHM as jwt.Algorithm) || 'HS512'

interface TokenPayload {
  userId: string
  email: string
  role: string
}

/**
 * Generate encrypted JWT token
 */
export function generateToken(payload: TokenPayload): string {
  // Encrypt the payload data
  const encryptedPayload = encryptTokenData(payload)

  // Create JWT with encrypted payload
  // Using type assertion since StringValue is a branded type from 'ms'
  // and JWT_EXPIRE is a valid time string format (e.g., '7d', '1h')
  const signPayload = {
    data: encryptedPayload,
    // strongly random JWT ID to prevent token replay across contexts
    jti: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
    sub: payload.userId,
    iat: Math.floor(Date.now() / 1000),
  }
  const signOptions: any = {
    expiresIn: JWT_EXPIRE,
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    notBefore: '0s',
  }
  if (JWT_AUDIENCE) {
    signOptions.audience = JWT_AUDIENCE
  }
  const token = jwt.sign(signPayload as any, JWT_SECRET, signOptions)

  return token
}

/**
 * Verify and decrypt JWT token
 */
export function verifyToken(token: string): TokenPayload {
  try {
    // Verify JWT token
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
    }
    if (JWT_AUDIENCE) {
      verifyOptions.audience = JWT_AUDIENCE
    }
    const decoded = jwt.verify(token, JWT_SECRET, verifyOptions) as { data: string }

    // Decrypt the payload data
    const decryptedPayload = decryptTokenData(decoded.data)

    return decryptedPayload as TokenPayload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token has expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token')
    }
    throw new Error('Token verification failed')
  }
}

/**
 * Generate password reset token
 */
export function generateResetToken(): string {
  // URL-safe random token
  return crypto.randomBytes(32).toString('base64url')
}

