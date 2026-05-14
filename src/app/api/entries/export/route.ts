import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TimeEntry } from '@/models/TimeEntry'
import { Project } from '@/models/Project'
import { MacroActivity } from '@/models/MacroActivity'
import { Collaborator } from '@/models/Collaborator'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
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

    const entries = await TimeEntry.find(filter).sort({ date: 1 }).lean()

    // Batch lookup for related data
    const projectIds = [...new Set(entries.map((e) => e.projectId.toString()))]
    const macroIds = [...new Set(entries.filter((e) => e.macroId).map((e) => e.macroId!.toString()))]
    const collabIds = [...new Set(entries.map((e) => e.collaboratorId.toString()))]

    const [projects, macros, collaborators] = await Promise.all([
      Project.find({ _id: { $in: projectIds } }).select('name').lean(),
      MacroActivity.find({ _id: { $in: macroIds } }).select('name').lean(),
      Collaborator.find({ _id: { $in: collabIds } }).select('name').lean(),
    ])

    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]))
    const macroMap = new Map(macros.map((m) => [m._id.toString(), m]))
    const collaboratorMap = new Map(collaborators.map((c) => [c._id.toString(), c]))

    if (format === 'xlsx') {
      // v1: return CSV format even for xlsx request
    }

    // Generate CSV
    const header =
      'date,projectId,projectName,macroId,macroName,collaboratorId,collaboratorName,hours,isSupport,statusSnapshot,progressSnapshot,note'
    const rows = entries.map((e) => {
      const date = new Date(e.date).toISOString().split('T')[0]
      const project = projectMap.get(e.projectId.toString())
      const macro = e.macroId ? macroMap.get(e.macroId.toString()) : null
      const collaborator = collaboratorMap.get(e.collaboratorId.toString())
      return [
        date,
        e.projectId,
        project ? `"${project.name}"` : '',
        e.macroId || '',
        macro ? `"${macro.name}"` : '',
        e.collaboratorId,
        collaborator ? `"${collaborator.name}"` : '',
        e.hours,
        e.isSupport,
        e.statusSnapshot,
        e.progressSnapshot ?? '',
        e.note ? `"${e.note}"` : '',
      ].join(',')
    })

    const csv = [header, ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="time-entries.csv"',
      },
    })
  } catch (error) {
    console.error('Export entries error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
