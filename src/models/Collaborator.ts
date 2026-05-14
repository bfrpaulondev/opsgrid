import mongoose, { Schema, Document } from 'mongoose'

export interface ICollaborator extends Document {
  name: string
  jobTitle?: string | null
  monthlyCapacityH: number
  supportPct: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

const CollaboratorSchema = new Schema<ICollaborator>(
  {
    name: { type: String, required: true },
    jobTitle: { type: String, default: null },
    monthlyCapacityH: { type: Number, default: 160 },
    supportPct: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

CollaboratorSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export const Collaborator = mongoose.models.Collaborator || mongoose.model<ICollaborator>('Collaborator', CollaboratorSchema)
