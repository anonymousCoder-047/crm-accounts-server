import mongoose from 'mongoose'
import User, { IUser } from '../models/User'

export interface CreateUserInput {
  name: string
  email: string
  role?: IUser['role']
  isActive?: boolean
  employeeId?: string
  department?: string
  position?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
  dateOfBirth?: Date
  hireDate?: Date
  manager?: mongoose.Types.ObjectId
  location?: string
  avatarUrl?: string
}

export interface UpdateUserInput extends Partial<CreateUserInput> {}

export async function createUser(input: CreateUserInput): Promise<IUser> {
  const user = await User.create(input as any)
  return user
}

export async function getUserById(id: string): Promise<IUser | null> {
  return User.findById(id)
}

export async function getUserByEmail(email: string): Promise<IUser | null> {
  return User.findOne({ email })
}

export async function listUsers(query?: {
  q?: string
  role?: IUser['role']
  isActive?: boolean
}) {
  const filter: any = {}
  if (query?.q) {
    filter.$or = [
      { name: { $regex: query.q, $options: 'i' } },
      { email: { $regex: query.q, $options: 'i' } },
      { department: { $regex: query.q, $options: 'i' } },
      { position: { $regex: query.q, $options: 'i' } },
    ]
  }
  if (query?.role) filter.role = query.role
  if (query?.isActive !== undefined) filter.isActive = query.isActive

  return User.find(filter).sort({ createdAt: -1 })
}

export async function updateUser(id: string, updates: UpdateUserInput): Promise<IUser | null> {
  return User.findByIdAndUpdate(id, updates as any, { new: true })
}

export async function deleteUser(id: string): Promise<IUser | null> {
  return User.findByIdAndDelete(id)
}


