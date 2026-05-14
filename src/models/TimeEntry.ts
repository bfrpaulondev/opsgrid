import mongoose, { Schema, Document, Types } from 'mongoose'

export interface ITimeEntry extends Document {
  date: Date
  projectId: Types.ObjectId
  macroId?: Types.ObjectId | null
  collaboratorId: Types.ObjectId
  hours: number
  isSupport: boolean
  statusSnapshot: string
  progressSnapshot?: number | null
  note?: string | null
  createdAt: Date
  updatedAt: Date
}

const TimeEntrySchema = new Schema<ITimeEntry>(
  {
    date: { type: Date, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    macroId: { type: Schema.Types.ObjectId, ref: 'MacroActivity', default: null },
    collaboratorId: { type: Schema.Types.ObjectId, ref: 'Collaborator', required: true },
    hours: { type: Number, required: true },
    isSupport: { type: Boolean, default: false },
    statusSnapshot: { type: String, default: 'IN_PROGRESS' },
    progressSnapshot: { type: Number, default: null },
    note: { type: String, default: null },
  },
  { timestamps: true }
)

// Indexes for common queries
TimeEntrySchema.index({ date: 1, collaboratorId: 1 })
TimeEntrySchema.index({ projectId: 1 })

TimeEntrySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const TimeEntry = mongoose.models.TimeEntry || mongoose.model<ITimeEntry>('TimeEntry', TimeEntrySchema)
