import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireLeader, requireAuth } from '@/lib/api-auth'
import { collaboratorCreateSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')

    const where = active === 'true' ? { active: true } : {}

    const collaborators = await db.collaborator.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(collaborators)
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

    const body = await request.json()
    const parsed = collaboratorCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const collaborator = await db.collaborator.create({
      data: parsed.data,
    })

    return NextResponse.json(collaborator, { status: 201 })
  } catch (error) {
    console.error('Create collaborator error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
