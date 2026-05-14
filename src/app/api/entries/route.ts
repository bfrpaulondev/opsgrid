import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { timeEntryCreateSchema } from '@/lib/validations'
import { calculateUtilization } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { searchParams } = new URL(request.url)
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
        project: { select: { id: true, name: true, type: true } },
        macro: { select: { id: true, name: true } },
        collaborator: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(entries)
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

    const entry = await db.timeEntry.create({ data })

    // Impact analysis warning: check if collaborator is overloaded for that month
    const entryDate = new Date(parsed.data.date)
    const monthStart = new Date(entryDate.getFullYear(), entryDate.getMonth(), 1)
    const monthEnd = new Date(entryDate.getFullYear(), entryDate.getMonth() + 1, 0, 23, 59, 59)

    const collaborator = await db.collaborator.findUnique({
      where: { id: parsed.data.collaboratorId },
    })

    let warning = null
    if (collaborator) {
      const monthEntries = await db.timeEntry.findMany({
        where: {
          collaboratorId: parsed.data.collaboratorId,
          date: { gte: monthStart, lte: monthEnd },
        },
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

    return NextResponse.json({ entry, warning }, { status: 201 })
  } catch (error) {
    console.error('Create entry error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
