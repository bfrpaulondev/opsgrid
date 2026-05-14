import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { PlannedAllocation } from '@/models/PlannedAllocation'
import { Collaborator } from '@/models/Collaborator'
import { TimeEntry } from '@/models/TimeEntry'
import { requireLeader, requireAuth } from '@/lib/api-auth'
import { allocationCreateSchema } from '@/lib/validations'
import { calculateUtilization } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')

    const filter: Record<string, unknown> = {}
    if (month) filter.month = month

    const allocations = await PlannedAllocation.find(filter)
      .populate('project', 'id name type status')
      .populate('collaborator', 'id name monthlyCapacityH')
      .sort({ createdAt: -1 })
      .lean()

    const result = allocations.map((a) => ({
      ...a,
      id: a._id.toString(),
      project: a.project
        ? {
            id: (a.project as any)._id?.toString() || (a.project as any).id,
            name: (a.project as any).name,
            type: (a.project as any).type,
            status: (a.project as any).status,
          }
        : null,
      collaborator: a.collaborator
        ? {
            id: (a.collaborator as any)._id?.toString() || (a.collaborator as any).id,
            name: (a.collaborator as any).name,
            monthlyCapacityH: (a.collaborator as any).monthlyCapacityH,
          }
        : null,
    }))

    return NextResponse.json(result)
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

    await connectDB()

    const body = await request.json()
    const parsed = allocationCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check for existing allocation (unique constraint: projectId + collaboratorId + month)
    const existing = await PlannedAllocation.findOne({
      projectId: parsed.data.projectId,
      collaboratorId: parsed.data.collaboratorId,
      month: parsed.data.month,
    })

    if (existing) {
      return NextResponse.json(
        { message: 'Allocation already exists for this project, collaborator and month' },
        { status: 409 }
      )
    }

    const allocation = await PlannedAllocation.create(parsed.data)

    // Impact analysis
    const monthNum = parseInt(parsed.data.month.split('-')[1]) - 1
    const yearNum = parseInt(parsed.data.month.split('-')[0])
    const monthStart = new Date(yearNum, monthNum, 1)
    const monthEnd = new Date(yearNum, monthNum + 1, 0, 23, 59, 59)

    const collaborator = await Collaborator.findById(parsed.data.collaboratorId)

    let warning = null
    if (collaborator) {
      // Get actual hours for the month
      const monthEntries = await TimeEntry.find({
        collaboratorId: parsed.data.collaboratorId,
        date: { $gte: monthStart, $lte: monthEnd },
      })
      const actualHours = monthEntries.reduce((sum, e) => sum + e.hours, 0)

      // Get all planned allocations for the month
      const monthAllocations = await PlannedAllocation.find({
        collaboratorId: parsed.data.collaboratorId,
        month: parsed.data.month,
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

    return NextResponse.json(
      {
        allocation: { ...allocation.toObject(), id: allocation._id.toString() },
        warning,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create allocation error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
