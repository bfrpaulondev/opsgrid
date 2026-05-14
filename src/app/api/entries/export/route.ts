import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TimeEntry } from '@/models/TimeEntry'
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

    const entries = await TimeEntry.find(filter)
      .populate('project', 'name')
      .populate('macro', 'name')
      .populate('collaborator', 'name')
      .sort({ date: 1 })
      .lean()

    if (format === 'xlsx') {
      // v1: return CSV format even for xlsx request
    }

    // Generate CSV
    const header =
      'date,projectId,projectName,macroId,macroName,collaboratorId,collaboratorName,hours,isSupport,statusSnapshot,progressSnapshot,note'
    const rows = entries.map((e) => {
      const date = new Date(e.date).toISOString().split('T')[0]
      const project = e.project as any
      const macro = e.macro as any
      const collaborator = e.collaborator as any
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
