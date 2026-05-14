import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IProject extends Document {
  name: string
  client?: string | null
  type: 'PROJECT' | 'MACRO' | 'INCIDENT' | 'REQUEST'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'TRIAGE' | 'BLOCKED' | 'DONE'
  startDate?: Date | null
  plannedDelivery?: Date | null
  actualDelivery?: Date | null
  riskNotes?: string | null
  createdAt: Date
  updatedAt: Date
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true },
    client: { type: String, default: null },
    type: { type: String, enum: ['PROJECT', 'MACRO', 'INCIDENT', 'REQUEST'], required: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
    status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'TRIAGE', 'BLOCKED', 'DONE'], default: 'NOT_STARTED' },
    startDate: { type: Date, default: null },
    plannedDelivery: { type: Date, default: null },
    actualDelivery: { type: Date, default: null },
    riskNotes: { type: String, default: null },
  },
  { timestamps: true }
)

ProjectSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const Project = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema)
