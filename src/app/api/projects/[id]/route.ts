import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireLeader, requireAuth } from '@/lib/api-auth'
import { projectUpdateSchema } from '@/lib/validations'
import { calculateFTE, calculateUtilization, calculateProgress } from '@/lib/business-rules'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { id } = await params

    const project = await db.project.findUnique({
      where: { id },
      include: {
        macros: {
          orderBy: { createdAt: 'asc' },
        },
        entries: true,
        allocations: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      )
    }

    // Aggregated data
    const totalHours = project.entries.reduce((sum, e) => sum + e.hours, 0)
    const totalFTE = calculateFTE(totalHours)
    const totalPlannedHours = project.allocations.reduce(
      (sum, a) => sum + a.plannedHours,
      0
    )
    const progress = calculateProgress(totalHours, totalPlannedHours)
    const utilization = calculateUtilization(totalHours, totalPlannedHours || 160)

    return NextResponse.json({
      ...project,
      aggregated: {
        totalHours: Math.round(totalHours * 100) / 100,
        totalFTE,
        totalPlannedHours: Math.round(totalPlannedHours * 100) / 100,
        progress,
        utilization,
      },
    })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireLeader(request)
    if (!authResult.success) return authResult.response

    const { id } = await params
    const body = await request.json()
    const parsed = projectUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      )
    }

    const data: Record<string, unknown> = { ...parsed.data }

    if (data.startDate) data.startDate = new Date(data.startDate as string)
    if (data.plannedDelivery)
      data.plannedDelivery = new Date(data.plannedDelivery as string)
    if (data.actualDelivery)
      data.actualDelivery = new Date(data.actualDelivery as string)

    const project = await db.project.update({ where: { id }, data })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Update project error:', error)
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

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      )
    }

    await db.project.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
