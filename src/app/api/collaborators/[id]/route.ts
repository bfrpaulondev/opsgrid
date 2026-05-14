import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Collaborator } from '@/models/Collaborator'
import { requireLeader } from '@/lib/api-auth'
import { collaboratorUpdateSchema } from '@/lib/validations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireLeader(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { id } = await params
    const body = await request.json()
    const parsed = collaboratorUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await Collaborator.findById(id)
    if (!existing) {
      return NextResponse.json(
        { message: 'Collaborator not found' },
        { status: 404 }
      )
    }

    const collaborator = await Collaborator.findByIdAndUpdate(id, parsed.data, {
      new: true,
    })

    return NextResponse.json({ ...collaborator!.toObject(), id: collaborator!._id.toString() })
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

    await connectDB()

    const { id } = await params

    const existing = await Collaborator.findById(id)
    if (!existing) {
      return NextResponse.json(
        { message: 'Collaborator not found' },
        { status: 404 }
      )
    }

    // Soft delete
    const collaborator = await Collaborator.findByIdAndUpdate(
      id,
      { active: false },
      { new: true }
    )

    return NextResponse.json({ ...collaborator!.toObject(), id: collaborator!._id.toString() })
  } catch (error) {
    console.error('Delete collaborator error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
