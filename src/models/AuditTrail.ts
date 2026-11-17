import mongoose, { Schema, Document } from 'mongoose'

export type LogType = 'api' | 'db' | 'error' | 'info' | 'warning'
export type ErrorType = 'app-error' | 'server-error' | 'db-error'

export interface IAuditTrail extends Document {
  type: LogType
  errorType?: ErrorType
  action: string // e.g., 'GET /api/users', 'CREATE User', 'DB_QUERY'
  method?: string // HTTP method
  path?: string // API path
  userId?: mongoose.Types.ObjectId // Reference to User
  userEmail?: string
  ipAddress?: string
  userAgent?: string
  requestBody?: any
  responseStatus?: number
  responseTime?: number // in milliseconds
  error?: {
    message?: string
    stack?: string
    code?: string
    details?: any
  }
  dbOperation?: string // e.g., 'find', 'create', 'update', 'delete'
  dbCollection?: string
  dbQuery?: any
  dbError?: {
    code?: string
    message: string
    details?: any
  }
  metadata?: Record<string, any>
  createdAt: Date
}

const AuditTrailSchema: Schema = new Schema(
  {
    type: {
      type: String,
      enum: ['api', 'db', 'error', 'info', 'warning'],
      required: true,
      index: true,
    },
    errorType: {
      type: String,
      enum: ['app-error', 'server-error', 'db-error'],
      index: true,
    },
    action: { type: String, required: true, index: true },
    method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] },
    path: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    userEmail: { type: String, index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    requestBody: { type: Schema.Types.Mixed },
    responseStatus: { type: Number, index: true },
    responseTime: { type: Number },
    error: {
      message: { type: String },
      stack: { type: String },
      code: { type: String },
      details: { type: Schema.Types.Mixed },
    },
    dbOperation: { type: String },
    dbCollection: { type: String, index: true },
    dbQuery: { type: Schema.Types.Mixed },
    dbError: {
      code: { type: String },
      message: { type: String },
      details: { type: Schema.Types.Mixed },
    },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
)

// Indexes for better query performance
AuditTrailSchema.index({ createdAt: -1 })
AuditTrailSchema.index({ type: 1, createdAt: -1 })
AuditTrailSchema.index({ errorType: 1, createdAt: -1 })
AuditTrailSchema.index({ userId: 1, createdAt: -1 })

export default mongoose.model<IAuditTrail>('AuditTrail', AuditTrailSchema)
