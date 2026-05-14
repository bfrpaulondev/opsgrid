import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Collaborator } from '@/models/Collaborator'
import { TimeEntry } from '@/models/TimeEntry'
import { requireAuth } from '@/lib/api-auth'
import { calculateUtilization } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

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

    const collaborators = await Collaborator.find({ active: true }).lean()

    const overloaded = []

    for (const collab of collaborators) {
      const entries = await TimeEntry.find({
        collaboratorId: collab._id,
        date: { $gte: monthStart, $lte: monthEnd },
      }).lean()

      const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
      const util = calculateUtilization(totalHours, collab.monthlyCapacityH)

      if (util > 100) {
        overloaded.push({
          id: collab._id.toString(),
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
