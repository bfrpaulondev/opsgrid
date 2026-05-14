import mongoose, { Schema, Document } from 'mongoose'

export interface IUser extends Document {
  email: string
  passwordHash: string
  name: string
  role: 'LEADER' | 'COLLABORATOR'
  collaboratorId?: mongoose.Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['LEADER', 'COLLABORATOR'], default: 'COLLABORATOR' },
    collaboratorId: { type: Schema.Types.ObjectId, ref: 'Collaborator', default: null },
  },
  { timestamps: true }
)

// Ensure virtual id field
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.passwordHash
    return ret
  },
})

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
