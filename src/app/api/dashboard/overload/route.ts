import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { calculateUtilization } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const now = new Date()
    const monthStr =
      monthParam ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const [yearStr, monthPart] = monthStr.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthPart) - 1
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59)

    const collaborators = await db.collaborator.findMany({
      where: { active: true },
    })

    const overloaded = []

    for (const collab of collaborators) {
      const entries = await db.timeEntry.findMany({
        where: {
          collaboratorId: collab.id,
          date: { gte: monthStart, lte: monthEnd },
        },
      })

      const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
      const util = calculateUtilization(totalHours, collab.monthlyCapacityH)

      if (util > 100) {
        overloaded.push({
          id: collab.id,
          name: collab.name,
          jobTitle: collab.jobTitle,
          totalHours: Math.round(totalHours * 100) / 100,
          capacity: collab.monthlyCapacityH,
          utilizationPct: util,
          supportPct: collab.supportPct,
        })
      }
    }

    // Sort by utilization descending
    overloaded.sort((a, b) => b.utilizationPct - a.utilizationPct)

    return NextResponse.json({ month: monthStr, overloaded })
  } catch (error) {
    console.error('Overload error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
