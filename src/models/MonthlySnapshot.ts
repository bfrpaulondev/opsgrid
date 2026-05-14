import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IMonthlySnapshot extends Document {
  month: string // "YYYY-MM"
  collaboratorId: Types.ObjectId
  totalHours: number
  supportHours: number
  projectHours: number
  capacityH: number
  utilizationPct: number
  createdAt: Date
}

const MonthlySnapshotSchema = new Schema<IMonthlySnapshot>(
  {
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    collaboratorId: { type: Schema.Types.ObjectId, ref: 'Collaborator', required: true },
    totalHours: { type: Number, required: true },
    supportHours: { type: Number, required: true },
    projectHours: { type: Number, required: true },
    capacityH: { type: Number, required: true },
    utilizationPct: { type: Number, required: true },
  },
  { timestamps: true }
)

MonthlySnapshotSchema.index({ month: 1, collaboratorId: 1 }, { unique: true })

MonthlySnapshotSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const MonthlySnapshot = mongoose.models.MonthlySnapshot || mongoose.model<IMonthlySnapshot>('MonthlySnapshot', MonthlySnapshotSchema)
