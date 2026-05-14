import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IMacroActivity extends Document {
  projectId: Types.ObjectId
  name: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'TRIAGE' | 'BLOCKED' | 'DONE'
  progressPct: number
  plannedDelivery?: Date | null
  createdAt: Date
  updatedAt: Date
}

const MacroActivitySchema = new Schema<IMacroActivity>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['NOT_STARTED', 'IN_PROGRESS', 'TRIAGE', 'BLOCKED', 'DONE'], default: 'NOT_STARTED' },
    progressPct: { type: Number, default: 0 },
    plannedDelivery: { type: Date, default: null },
  },
  { timestamps: true }
)

MacroActivitySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const MacroActivity = mongoose.models.MacroActivity || mongoose.model<IMacroActivity>('MacroActivity', MacroActivitySchema)
