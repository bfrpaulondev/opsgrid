import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Project } from '@/models/Project'
import { MacroActivity } from '@/models/MacroActivity'
import { TimeEntry } from '@/models/TimeEntry'
import { requireAuth } from '@/lib/api-auth'
import { isLate } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const projects = await Project.find({ status: { $ne: 'DONE' } }).lean()

    const lateWithDetails = await Promise.all(
      projects
        .filter((p) => isLate(p.plannedDelivery, p.status))
        .map(async (p) => {
          const [macroCount, entryCount] = await Promise.all([
            MacroActivity.countDocuments({ projectId: p._id }),
            TimeEntry.countDocuments({ projectId: p._id }),
          ])

          return {
            id: p._id.toString(),
            name: p.name,
            client: p.client,
            type: p.type,
            priority: p.priority,
            status: p.status,
            plannedDelivery: p.plannedDelivery,
            riskNotes: p.riskNotes,
            macroCount,
            entryCount,
          }
        })
    )

    // Sort by priority (CRITICAL first)
    const priorityOrder: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    }
    lateWithDetails.sort(
      (a, b) =>
        (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99)
    )

    return NextResponse.json({ lateProjects: lateWithDetails })
  } catch (error) {
    console.error('Late projects error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
