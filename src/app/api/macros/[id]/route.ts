import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireLeader } from '@/lib/api-auth'
import { macroUpdateSchema } from '@/lib/validations'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireLeader(request)
    if (!authResult.success) return authResult.response

    const { id } = await params
    const body = await request.json()
    const parsed = macroUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await db.macroActivity.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { message: 'Macro not found' },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = { ...parsed.data }
    if (data.plannedDelivery)
      data.plannedDelivery = new Date(data.plannedDelivery as string)

    const macro = await db.macroActivity.update({ where: { id }, data })

    return NextResponse.json(macro)
  } catch (error) {
    console.error('Update macro error:', error)
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

    const existing = await db.macroActivity.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { message: 'Macro not found' },
        { status: 404 }
      )
    }

    await db.macroActivity.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete macro error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
