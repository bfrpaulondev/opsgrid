import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { PlannedAllocation } from '@/models/PlannedAllocation'
import { Project } from '@/models/Project'
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
      .sort({ createdAt: -1 })
      .lean()

    // Batch lookup related data
    const projectIds = [...new Set(allocations.map((a) => a.projectId.toString()))]
    const collabIds = [...new Set(allocations.map((a) => a.collaboratorId.toString()))]

    const [projects, collaborators] = await Promise.all([
      Project.find({ _id: { $in: projectIds } }).select('name type status').lean(),
      Collaborator.find({ _id: { $in: collabIds } }).select('name monthlyCapacityH').lean(),
    ])

    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]))
    const collaboratorMap = new Map(collaborators.map((c) => [c._id.toString(), c]))

    const result = allocations.map((a) => {
      const p = projectMap.get(a.projectId.toString())
      const c = collaboratorMap.get(a.collaboratorId.toString())
      return {
        id: a._id.toString(),
        projectId: a.projectId.toString(),
        collaboratorId: a.collaboratorId.toString(),
        month: a.month,
        plannedHours: a.plannedHours,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        project: p ? { id: p._id.toString(), name: p.name, type: p.type, status: p.status } : null,
        collaborator: c ? { id: c._id.toString(), name: c.name, monthlyCapacityH: c.monthlyCapacityH } : null,
      }
    })

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

    // Check for existing allocation
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
      const monthEntries = await TimeEntry.find({
        collaboratorId: parsed.data.collaboratorId,
        date: { $gte: monthStart, $lte: monthEnd },
      })
      const actualHours = monthEntries.reduce((sum, e) => sum + e.hours, 0)

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
