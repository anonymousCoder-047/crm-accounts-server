import mongoose, { Schema, Document } from 'mongoose'

export interface IInquiry extends Document {
  name: string
  email: string
  phone: string
  message: string
  status: 'new' | 'contacted' | 'resolved' | 'archived'
  createdAt: Date
  updatedAt: Date
}

const InquirySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Please provide a message'],
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'resolved', 'archived'],
      default: 'new',
    },
  },
  {
    timestamps: true,
  }
)

export default mongoose.model<IInquiry>('Inquiry', InquirySchema)

