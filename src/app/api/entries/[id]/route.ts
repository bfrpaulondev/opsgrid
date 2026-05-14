import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { timeEntryUpdateSchema } from '@/lib/validations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { id } = await params
    const body = await request.json()
    const parsed = timeEntryUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await db.timeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { message: 'Time entry not found' },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = { ...parsed.data }
    if (data.date) data.date = new Date(data.date as string)

    const entry = await db.timeEntry.update({ where: { id }, data })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Update entry error:', error)
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
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { id } = await params

    const existing = await db.timeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { message: 'Time entry not found' },
        { status: 404 }
      )
    }

    await db.timeEntry.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete entry error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
