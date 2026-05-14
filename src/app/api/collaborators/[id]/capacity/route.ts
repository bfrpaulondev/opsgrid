import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Collaborator } from '@/models/Collaborator'
import { TimeEntry } from '@/models/TimeEntry'
import { requireAuth } from '@/lib/api-auth'
import { calculateUtilization } from '@/lib/business-rules'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    const collaborator = await Collaborator.findById(id)
    if (!collaborator) {
      return NextResponse.json(
        { message: 'Collaborator not found' },
        { status: 404 }
      )
    }

    const capacity = collaborator.monthlyCapacityH

    // Get all entries for this collaborator in the given year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31, 23, 59, 59)

    const entries = await TimeEntry.find({
      collaboratorId: id,
      date: { $gte: startDate, $lte: endDate },
    }).lean()

    // Build monthly matrix
    const monthlyMatrix = []
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1)
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)

      const monthEntries = entries.filter((e) => {
        const d = new Date(e.date)
        return d >= monthStart && d <= monthEnd
      })

      const totalHours = monthEntries.reduce((sum, e) => sum + e.hours, 0)
      const supportHours = monthEntries
        .filter((e) => e.isSupport)
        .reduce((sum, e) => sum + e.hours, 0)
      const projectHours = totalHours - supportHours
      const utilizationPct = calculateUtilization(totalHours, capacity)

      monthlyMatrix.push({
        month: `${year}-${String(month + 1).padStart(2, '0')}`,
        totalHours: Math.round(totalHours * 100) / 100,
        supportHours: Math.round(supportHours * 100) / 100,
        projectHours: Math.round(projectHours * 100) / 100,
        capacity,
        utilizationPct,
      })
    }

    return NextResponse.json({
      collaboratorId: id,
      collaboratorName: collaborator.name,
      year,
      monthlyCapacityH: capacity,
      months: monthlyMatrix,
    })
  } catch (error) {
    console.error('Capacity matrix error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
