import AuditTrail, { IAuditTrail, LogType, ErrorType } from '../models/AuditTrail'
import { FilterQuery } from 'mongoose'

export interface AuditTrailQuery {
  type?: LogType
  errorType?: ErrorType
  userId?: string
  path?: string
  method?: string
  from?: string
  to?: string
  q?: string
  limit?: number
  skip?: number
}

export async function createAuditTrail(data: Partial<IAuditTrail>): Promise<IAuditTrail> {
  return AuditTrail.create(data as any)
}

export async function listAuditTrails(query?: AuditTrailQuery): Promise<{
  data: IAuditTrail[]
  total: number
  page: number
  limit: number
}> {
  const filter: FilterQuery<IAuditTrail> = {}

  if (query?.type) {
    filter.type = query.type
  }

  if (query?.errorType) {
    filter.errorType = query.errorType
  }

  if (query?.userId) {
    filter.userId = query.userId
  }

  if (query?.path) {
    filter.path = new RegExp(query.path, 'i')
  }

  if (query?.method) {
    filter.method = query.method
  }

  if (query?.from || query?.to) {
    filter.createdAt = {}
    if (query.from) (filter.createdAt as any).$gte = new Date(query.from)
    if (query.to) (filter.createdAt as any).$lte = new Date(query.to)
  }

  if (query?.q) {
    filter.$or = [
      { action: new RegExp(query.q, 'i') },
      { path: new RegExp(query.q, 'i') },
      { userEmail: new RegExp(query.q, 'i') },
      { 'error.message': new RegExp(query.q, 'i') },
    ]
  }

  const limit = query?.limit || 50
  const skip = query?.skip || 0

  const [data, total] = await Promise.all([
    AuditTrail.find(filter)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip),
    AuditTrail.countDocuments(filter),
  ])

  return {
    data,
    total,
    page: Math.floor(skip / limit) + 1,
    limit,
  }
}

export async function getAuditTrailById(id: string): Promise<IAuditTrail | null> {
  return AuditTrail.findById(id).populate('userId', 'name email role')
}

export async function deleteAuditTrail(id: string): Promise<IAuditTrail | null> {
  return AuditTrail.findByIdAndDelete(id)
}

export async function deleteOldAuditTrails(daysToKeep: number = 90): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

  const result = await AuditTrail.deleteMany({
    createdAt: { $lt: cutoffDate },
  })

  return result.deletedCount || 0
}

// Get statistics
export async function getAuditTrailStats(from?: Date, to?: Date): Promise<{
  total: number
  byType: Record<LogType, number>
  byErrorType: Record<ErrorType, number>
  byStatus: Record<number, number>
  topPaths: Array<{ path: string; count: number }>
  topUsers: Array<{ userId: string; userEmail: string; count: number }>
}> {
  const dateFilter: any = {}
  if (from || to) {
    dateFilter.createdAt = {}
    if (from) dateFilter.createdAt.$gte = from
    if (to) dateFilter.createdAt.$lte = to
  }

  const [total, byType, byErrorType, byStatus, topPaths, topUsers] = await Promise.all([
    AuditTrail.countDocuments(dateFilter),
    AuditTrail.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    AuditTrail.aggregate([
      { $match: { ...dateFilter, errorType: { $exists: true } } },
      { $group: { _id: '$errorType', count: { $sum: 1 } } },
    ]),
    AuditTrail.aggregate([
      { $match: { ...dateFilter, responseStatus: { $exists: true } } },
      { $group: { _id: '$responseStatus', count: { $sum: 1 } } },
    ]),
    AuditTrail.aggregate([
      { $match: { ...dateFilter, path: { $exists: true } } },
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    AuditTrail.aggregate([
      { $match: { ...dateFilter, userId: { $exists: true } } },
      { $group: { _id: { userId: '$userId', userEmail: '$userEmail' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ])

  return {
    total,
    byType: byType.reduce((acc, item) => {
      acc[item._id as LogType] = item.count
      return acc
    }, {} as Record<LogType, number>),
    byErrorType: byErrorType.reduce((acc, item) => {
      acc[item._id as ErrorType] = item.count
      return acc
    }, {} as Record<ErrorType, number>),
    byStatus: byStatus.reduce((acc, item) => {
      acc[item._id] = item.count
      return acc
    }, {} as Record<number, number>),
    topPaths: topPaths.map((item) => ({ path: item._id, count: item.count })),
    topUsers: topUsers.map((item) => ({
      userId: item._id.userId?.toString() || '',
      userEmail: item._id.userEmail || '',
      count: item.count,
    })),
  }
}

