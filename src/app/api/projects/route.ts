import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Project } from '@/models/Project'
import { MacroActivity } from '@/models/MacroActivity'
import { TimeEntry } from '@/models/TimeEntry'
import { PlannedAllocation } from '@/models/PlannedAllocation'
import { requireLeader, requireAuth } from '@/lib/api-auth'
import { projectCreateSchema } from '@/lib/validations'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    const filter: Record<string, string> = {}
    if (type) filter.type = type
    if (status) filter.status = status
    if (priority) filter.priority = priority

    const projects = await Project.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    // Attach macros and counts for each project
    const result = await Promise.all(
      projects.map(async (project) => {
        const [macros, entryCount, allocationCount] = await Promise.all([
          MacroActivity.find({ projectId: project._id }).sort({ createdAt: 1 }).lean(),
          TimeEntry.countDocuments({ projectId: project._id }),
          PlannedAllocation.countDocuments({ projectId: project._id }),
        ])

        return {
          id: project._id.toString(),
          name: project.name,
          client: project.client,
          type: project.type,
          priority: project.priority,
          status: project.status,
          startDate: project.startDate,
          plannedDelivery: project.plannedDelivery,
          actualDelivery: project.actualDelivery,
          riskNotes: project.riskNotes,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          macros: macros.map((m) => ({
            id: m._id.toString(),
            projectId: m.projectId.toString(),
            name: m.name,
            status: m.status,
            progressPct: m.progressPct,
            plannedDelivery: m.plannedDelivery,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
          })),
          _count: {
            entries: entryCount,
            allocations: allocationCount,
          },
        }
      })
    )

    return NextResponse.json(result)
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

    await connectDB()

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

    const project = await Project.create(data)

    return NextResponse.json(
      { ...project.toObject(), id: project._id.toString() },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
