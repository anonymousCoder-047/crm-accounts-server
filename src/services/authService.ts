import mongoose from 'mongoose'
import Auth, { IAuth } from '../models/Auth'
import bcrypt from 'bcryptjs'

export interface CreateAuthInput {
  username: string
  email: string
  password: string
  user_profile: mongoose.Types.ObjectId
  created_by?: mongoose.Types.ObjectId
  ip_address?: string
  country?: string
}

export interface UpdateAuthInput {
  username?: string
  email?: string
  password?: string
  resetToken?: string
  lastLogin?: Date
  updated_by?: mongoose.Types.ObjectId
  ip_address?: string
  country?: string
  token_expiry?: Date
  otp?: string
  active?: boolean
}

export async function createAuth(input: CreateAuthInput): Promise<IAuth> {
  const salt = await bcrypt.genSalt(10)
  const hashed = await bcrypt.hash(input.password, salt)
  const created = await Auth.create({
    ...input,
    password: hashed,
  })
  return created
}

export async function getAuthByUserProfile(userProfileId: string): Promise<IAuth | null> {
  return Auth.findOne({ user_profile: userProfileId }).select('+password')
}

export async function getAuthByEmail(email: string): Promise<IAuth | null> {
  return Auth.findOne({ email }).select('+password')
}

export async function getAuthByUsername(username: string): Promise<IAuth | null> {
  return Auth.findOne({ username }).select('+password')
}

export async function updateAuth(
  id: string,
  updates: UpdateAuthInput
): Promise<IAuth | null> {
  const toUpdate: any = { ...updates }
  if (updates.password) {
    const salt = await bcrypt.genSalt(10)
    toUpdate.password = await bcrypt.hash(updates.password, salt)
  }
  return Auth.findByIdAndUpdate(id, toUpdate, { new: true })
}

export async function touchLastLogin(
  id: string,
  ip?: string,
  country?: string
): Promise<IAuth | null> {
  return Auth.findByIdAndUpdate(
    id,
    {
      lastLogin: new Date(),
      ...(ip ? { ip_address: ip } : {}),
      ...(country ? { country } : {}),
    },
    { new: true }
  )
}

export async function setResetToken(
  id: string,
  token: string,
  expiry: Date
): Promise<IAuth | null> {
  return Auth.findByIdAndUpdate(
    id,
    { resetToken: token, token_expiry: expiry },
    { new: true }
  )
}

export async function setOtp(
  id: string,
  otp: string,
  expiry?: Date
): Promise<IAuth | null> {
  return Auth.findByIdAndUpdate(
    id,
    { otp, ...(expiry ? { token_expiry: expiry } : {}) },
    { new: true }
  )
}


