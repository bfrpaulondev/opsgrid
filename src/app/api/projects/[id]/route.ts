import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Project } from '@/models/Project'
import { MacroActivity } from '@/models/MacroActivity'
import { TimeEntry } from '@/models/TimeEntry'
import { PlannedAllocation } from '@/models/PlannedAllocation'
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

    await connectDB()

    const { id } = await params

    const project = await Project.findById(id).lean()

    if (!project) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      )
    }

    const [macros, entries, allocations] = await Promise.all([
      MacroActivity.find({ projectId: id }).sort({ createdAt: 1 }).lean(),
      TimeEntry.find({ projectId: id }).lean(),
      PlannedAllocation.find({ projectId: id }).lean(),
    ])

    // Aggregated data
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
    const totalFTE = calculateFTE(totalHours)
    const totalPlannedHours = allocations.reduce(
      (sum, a) => sum + a.plannedHours,
      0
    )
    const progress = calculateProgress(totalHours, totalPlannedHours)
    const utilization = calculateUtilization(totalHours, totalPlannedHours || 160)

    return NextResponse.json({
      ...project,
      id: project._id.toString(),
      macros: macros.map((m) => ({ ...m, id: m._id.toString() })),
      entries: entries.map((e) => ({ ...e, id: e._id.toString() })),
      allocations: allocations.map((a) => ({ ...a, id: a._id.toString() })),
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

    await connectDB()

    const { id } = await params
    const body = await request.json()
    const parsed = projectUpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await Project.findById(id)
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

    const project = await Project.findByIdAndUpdate(id, data, { new: true })

    return NextResponse.json({ ...project!.toObject(), id: project!._id.toString() })
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

    await connectDB()

    const { id } = await params

    const existing = await Project.findById(id)
    if (!existing) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      )
    }

    // Delete related macros, entries, and allocations
    await MacroActivity.deleteMany({ projectId: id })
    await TimeEntry.deleteMany({ projectId: id })
    await PlannedAllocation.deleteMany({ projectId: id })
    await Project.findByIdAndDelete(id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
