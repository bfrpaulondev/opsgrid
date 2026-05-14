import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireLeader } from '@/lib/api-auth'
import { collaboratorUpdateSchema } from '@/lib/validations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireLeader(request)
    if (!authResult.success) return authResult.response

    const { id } = await params
    const body = await request.json()
    const parsed = collaboratorUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await db.collaborator.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { message: 'Collaborator not found' },
        { status: 404 }
      )
    }

    const collaborator = await db.collaborator.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json(collaborator)
  } catch (error) {
    console.error('Update collaborator error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireLeader(request)
    if (!authResult.success) return authResult.response

    const { id } = await params

    const existing = await db.collaborator.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { message: 'Collaborator not found' },
        { status: 404 }
      )
    }

    // Soft delete
    const collaborator = await db.collaborator.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json(collaborator)
  } catch (error) {
    console.error('Delete collaborator error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
