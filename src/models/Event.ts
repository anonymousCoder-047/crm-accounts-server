import mongoose, { Schema, Document } from 'mongoose'

export interface IEvent extends Document {
  title: string
  description: string
  startTime: Date
  endTime: Date
  clientId: mongoose.Types.ObjectId
  type: 'assessment' | 'counseling' | 'event' | 'other'
  status: 'scheduled' | 'completed' | 'cancelled'
  createdAt: Date
  updatedAt: Date
}

const EventSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide an event title'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Please provide a start time'],
    },
    endTime: {
      type: Date,
      required: [true, 'Please provide an end time'],
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    type: {
      type: String,
      enum: ['assessment', 'counseling', 'event', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
  },
  {
    timestamps: true,
  }
)

export default mongoose.model<IEvent>('Event', EventSchema)

