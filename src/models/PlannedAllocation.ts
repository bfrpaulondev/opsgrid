import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IPlannedAllocation extends Document {
  projectId: Types.ObjectId
  collaboratorId: Types.ObjectId
  month: string // "YYYY-MM"
  plannedHours: number
  createdAt: Date
  updatedAt: Date
}

const PlannedAllocationSchema = new Schema<IPlannedAllocation>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    collaboratorId: { type: Schema.Types.ObjectId, ref: 'Collaborator', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    plannedHours: { type: Number, required: true },
  },
  { timestamps: true }
)

// Unique compound index
PlannedAllocationSchema.index({ projectId: 1, collaboratorId: 1, month: 1 }, { unique: true })

PlannedAllocationSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const PlannedAllocation = mongoose.models.PlannedAllocation || mongoose.model<IPlannedAllocation>('PlannedAllocation', PlannedAllocationSchema)
