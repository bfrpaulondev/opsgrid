import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireLeader, requireAuth } from '@/lib/api-auth'
import { allocationCreateSchema } from '@/lib/validations'
import { calculateUtilization } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')

    const where: Record<string, unknown> = {}
    if (month) where.month = month

    const allocations = await db.plannedAllocation.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, type: true, status: true } },
        collaborator: { select: { id: true, name: true, monthlyCapacityH: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(allocations)
  } catch (error) {
    console.error('List allocations error:', error)
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
    const parsed = allocationCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check for existing allocation (unique constraint: projectId + collaboratorId + month)
    const existing = await db.plannedAllocation.findUnique({
      where: {
        projectId_collaboratorId_month: {
          projectId: parsed.data.projectId,
          collaboratorId: parsed.data.collaboratorId,
          month: parsed.data.month,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { message: 'Allocation already exists for this project, collaborator and month' },
        { status: 409 }
      )
    }

    const allocation = await db.plannedAllocation.create({
      data: parsed.data,
    })

    // Impact analysis
    const monthNum = parseInt(parsed.data.month.split('-')[1]) - 1
    const yearNum = parseInt(parsed.data.month.split('-')[0])
    const monthStart = new Date(yearNum, monthNum, 1)
    const monthEnd = new Date(yearNum, monthNum + 1, 0, 23, 59, 59)

    const collaborator = await db.collaborator.findUnique({
      where: { id: parsed.data.collaboratorId },
    })

    let warning = null
    if (collaborator) {
      // Get actual hours for the month
      const monthEntries = await db.timeEntry.findMany({
        where: {
          collaboratorId: parsed.data.collaboratorId,
          date: { gte: monthStart, lte: monthEnd },
        },
      })
      const actualHours = monthEntries.reduce((sum, e) => sum + e.hours, 0)

      // Get all planned allocations for the month
      const monthAllocations = await db.plannedAllocation.findMany({
        where: {
          collaboratorId: parsed.data.collaboratorId,
          month: parsed.data.month,
        },
      })
      const totalPlanned = monthAllocations.reduce(
        (sum, a) => sum + a.plannedHours,
        0
      )

      const projectedHours = actualHours + totalPlanned
      const utilization = calculateUtilization(
        projectedHours,
        collaborator.monthlyCapacityH
      )

      if (utilization > 100) {
        warning = {
          type: 'OVERLOAD',
          message: `Collaborator ${collaborator.name} would be at ${utilization.toFixed(1)}% utilization for ${parsed.data.month}`,
          utilizationPct: utilization,
        }
      }
    }

    return NextResponse.json({ allocation, warning }, { status: 201 })
  } catch (error) {
    console.error('Create allocation error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
