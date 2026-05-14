import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TimeEntry } from '@/models/TimeEntry'
import { Collaborator } from '@/models/Collaborator'
import { requireAuth } from '@/lib/api-auth'
import { timeEntryCreateSchema } from '@/lib/validations'
import { calculateUtilization } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const collaboratorId = searchParams.get('collaboratorId')
    const projectId = searchParams.get('projectId')

    const filter: Record<string, unknown> = {}

    if (from || to) {
      filter.date = {}
      if (from) (filter.date as Record<string, unknown>).$gte = new Date(from)
      if (to) (filter.date as Record<string, unknown>).$lte = new Date(to)
    }
    if (collaboratorId) filter.collaboratorId = collaboratorId
    if (projectId) filter.projectId = projectId

    const entries = await TimeEntry.find(filter)
      .populate('project', 'id name type')
      .populate('macro', 'id name')
      .populate('collaborator', 'id name')
      .sort({ date: -1 })
      .lean()

    const result = entries.map((entry) => ({
      ...entry,
      id: entry._id.toString(),
      project: entry.project
        ? {
            id: (entry.project as any)._id?.toString() || (entry.project as any).id,
            name: (entry.project as any).name,
            type: (entry.project as any).type,
          }
        : null,
      macro: entry.macro
        ? {
            id: (entry.macro as any)._id?.toString() || (entry.macro as any).id,
            name: (entry.macro as any).name,
          }
        : null,
      collaborator: entry.collaborator
        ? {
            id: (entry.collaborator as any)._id?.toString() || (entry.collaborator as any).id,
            name: (entry.collaborator as any).name,
          }
        : null,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('List entries error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const body = await request.json()
    const parsed = timeEntryCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {
      ...parsed.data,
      date: new Date(parsed.data.date),
    }

    const entry = await TimeEntry.create(data)

    // Impact analysis warning: check if collaborator is overloaded for that month
    const entryDate = new Date(parsed.data.date)
    const monthStart = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1)
    const monthEnd = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0, 23, 59, 59)

    const collaborator = await Collaborator.findById(parsed.data.collaboratorId)

    let warning = null
    if (collaborator) {
      const monthEntries = await TimeEntry.find({
        collaboratorId: parsed.data.collaboratorId,
        date: { $gte: monthStart, $lte: monthEnd },
      })
      const totalHours = monthEntries.reduce((sum, e) => sum + e.hours, 0)
      const utilization = calculateUtilization(
        totalHours,
        collaborator.monthlyCapacityH
      )
      if (utilization > 100) {
        warning = {
          type: 'OVERLOAD',
          message: `Collaborator ${collaborator.name} is at ${utilization.toFixed(1)}% utilization for this month`,
          utilizationPct: utilization,
        }
      }
    }

    return NextResponse.json(
      {
        entry: { ...entry.toObject(), id: entry._id.toString() },
        warning,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create entry error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
