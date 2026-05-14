import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Collaborator } from '@/models/Collaborator'
import { User } from '@/models/User'
import { requireLeader, requireAuth } from '@/lib/api-auth'
import { collaboratorCreateSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')

    const filter = active === 'true' ? { active: true } : {}

    const collaborators = await Collaborator.find(filter).sort({ name: 1 }).lean()

    // Attach user info for each collaborator
    const result = await Promise.all(
      collaborators.map(async (collab) => {
        const user = await User.findOne({ collaboratorId: collab._id })
          .select('email name role')
          .lean()

        return {
          id: collab._id.toString(),
          name: collab.name,
          jobTitle: collab.jobTitle,
          monthlyCapacityH: collab.monthlyCapacityH,
          supportPct: collab.supportPct,
          active: collab.active,
          createdAt: collab.createdAt,
          updatedAt: collab.updatedAt,
          user: user
            ? {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
              }
            : null,
        }
      })
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('List collaborators error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireLeader(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const body = await request.json()
    const parsed = collaboratorCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const collaborator = await Collaborator.create(parsed.data)

    return NextResponse.json(
      { ...collaborator.toObject(), id: collaborator._id.toString() },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create collaborator error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
