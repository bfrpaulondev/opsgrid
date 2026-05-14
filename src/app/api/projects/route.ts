import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireLeader, requireAuth } from '@/lib/api-auth'
import { projectCreateSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const where: Record<string, string> = {}
    if (type) where.type = type
    if (status) where.status = status
    if (priority) where.priority = priority

    const projects = await db.project.findMany({
      where,
      include: {
        macros: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { entries: true, allocations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('List projects error:', error)
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
    const parsed = projectCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = { ...parsed.data }

    // Convert date strings to Date objects
    if (data.startDate) data.startDate = new Date(data.startDate as string)
    if (data.plannedDelivery)
      data.plannedDelivery = new Date(data.plannedDelivery as string)
    if (data.actualDelivery)
      data.actualDelivery = new Date(data.actualDelivery as string)

    const project = await db.project.create({ data })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
