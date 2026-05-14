import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TimeEntry } from '@/models/TimeEntry'
import { Project } from '@/models/Project'
import { MacroActivity } from '@/models/MacroActivity'
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

    const entries = await TimeEntry.find(filter).sort({ date: -1 }).lean()

    // Collect unique IDs for batch lookup
    const projectIds = [...new Set(entries.map((e) => e.projectId.toString()))]
    const macroIds = [...new Set(entries.filter((e) => e.macroId).map((e) => e.macroId!.toString()))]
    const collabIds = [...new Set(entries.map((e) => e.collaboratorId.toString()))]

    const [projects, macros, collaborators] = await Promise.all([
      Project.find({ _id: { $in: projectIds } }).select('name type').lean(),
      MacroActivity.find({ _id: { $in: macroIds } }).select('name').lean(),
      Collaborator.find({ _id: { $in: collabIds } }).select('name').lean(),
    ])

    // Build lookup maps
    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]))
    const macroMap = new Map(macros.map((m) => [m._id.toString(), m]))
    const collaboratorMap = new Map(collaborators.map((c) => [c._id.toString(), c]))

    const result = entries.map((entry) => ({
      ...entry,
      id: entry._id.toString(),
      projectId: entry.projectId.toString(),
      macroId: entry.macroId ? entry.macroId.toString() : null,
      collaboratorId: entry.collaboratorId.toString(),
      project: (() => {
        const p = projectMap.get(entry.projectId.toString())
        return p ? { id: p._id.toString(), name: p.name, type: p.type } : null
      })(),
      macro: entry.macroId
        ? (() => {
            const m = macroMap.get(entry.macroId.toString())
            return m ? { id: m._id.toString(), name: m.name } : null
          })()
        : null,
      collaborator: (() => {
        const c = collaboratorMap.get(entry.collaboratorId.toString())
        return c ? { id: c._id.toString(), name: c.name } : null
      })(),
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
