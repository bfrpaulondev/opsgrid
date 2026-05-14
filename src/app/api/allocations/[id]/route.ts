import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { PlannedAllocation } from '@/models/PlannedAllocation'
import { requireLeader } from '@/lib/api-auth'
import { allocationUpdateSchema } from '@/lib/validations'

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
    const parsed = allocationUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await PlannedAllocation.findById(id)
    if (!existing) {
      return NextResponse.json(
        { message: 'Allocation not found' },
        { status: 404 }
      )
    }

    const allocation = await PlannedAllocation.findByIdAndUpdate(id, parsed.data, {
      new: true,
    })

    return NextResponse.json({ ...allocation!.toObject(), id: allocation!._id.toString() })
  } catch (error) {
    console.error('Update allocation error:', error)
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

    const existing = await PlannedAllocation.findById(id)
    if (!existing) {
      return NextResponse.json(
        { message: 'Allocation not found' },
        { status: 404 }
      )
    }

    await PlannedAllocation.findByIdAndDelete(id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete allocation error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
