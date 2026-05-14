import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const collaboratorId = searchParams.get('collaboratorId')
    const projectId = searchParams.get('projectId')

    const where: Record<string, unknown> = {}

    if (from || to) {
      where.date = {}
      if (from) (where.date as Record<string, unknown>).gte = new Date(from)
      if (to) (where.date as Record<string, unknown>).lte = new Date(to)
    }
    if (collaboratorId) where.collaboratorId = collaboratorId
    if (projectId) where.projectId = projectId

    const entries = await db.timeEntry.findMany({
      where,
      include: {
        project: { select: { name: true } },
        macro: { select: { name: true } },
        collaborator: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    })

    if (format === 'xlsx') {
      // v1: return CSV format even for xlsx request
    }

    // Generate CSV
    const header =
      'date,projectId,projectName,macroId,macroName,collaboratorId,collaboratorName,hours,isSupport,statusSnapshot,progressSnapshot,note'
    const rows = entries.map((e) => {
      const date = new Date(e.date).toISOString().split('T')[0]
      return [
        date,
        e.projectId,
        `"${e.project.name}"`,
        e.macroId || '',
        e.macro ? `"${e.macro.name}"` : '',
        e.collaboratorId,
        `"${e.collaborator.name}"`,
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
