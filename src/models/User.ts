import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  // Identity
  name: string
  email: string
  role: 'superadmin' | 'admin' | 'user' | 'manager'
  isActive: boolean

  // Employee profile fields
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

  // Timestamps
  createdAt: Date
  updatedAt: Date
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'user', 'manager'],
      default: 'user',
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Employee profile fields
    employeeId: { type: String, index: true, sparse: true, trim: true },
    department: { type: String, trim: true },
    position: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    dateOfBirth: { type: Date },
    hireDate: { type: Date },
    manager: { type: Schema.Types.ObjectId, ref: 'User' },
    location: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
)

export default mongoose.model<IUser>('User', UserSchema)

