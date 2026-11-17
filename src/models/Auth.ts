import mongoose, { Schema, Document } from 'mongoose'

export interface IAuth extends Document {
  username: string
  email: string
  password: string
  resetToken?: string
  lastLogin?: Date
  created_by?: mongoose.Types.ObjectId
  updated_by?: mongoose.Types.ObjectId
  ip_address?: string
  country?: string
  user_profile: mongoose.Types.ObjectId
  token_expiry?: Date
  otp?: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const emailRegex =
  /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/

const ipRegex =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?!$)|$)){4}$/

const otpRegex = /^\d{4,8}$/

const AuthSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Please provide a username'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [32, 'Username cannot exceed 32 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailRegex, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    resetToken: {
      type: String,
      index: true,
      sparse: true,
    },
    lastLogin: {
      type: Date,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    ip_address: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          if (!v) return true
          return ipRegex.test(v)
        },
        message: 'Please provide a valid IPv4 address',
      },
    },
    country: {
      type: String,
      trim: true,
      maxlength: [56, 'Country name seems too long'],
    },
    user_profile: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User profile is required'],
      index: true,
      unique: true,
    },
    token_expiry: {
      type: Date,
    },
    otp: {
      type: String,
      match: [otpRegex, 'OTP must be 4 to 8 digits'],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

export default mongoose.model<IAuth>('Auth', AuthSchema)


