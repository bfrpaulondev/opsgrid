import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Collaborator } from '@/models/Collaborator'
import { TimeEntry } from '@/models/TimeEntry'
import { Project } from '@/models/Project'
import { requireAuth } from '@/lib/api-auth'
import { calculateUtilization, isLate } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const recommendations: string[] = []

    // Check overloaded collaborators (current month)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    )

    const collaborators = await Collaborator.find({ active: true }).lean()

    for (const collab of collaborators) {
      const entries = await TimeEntry.find({
        collaboratorId: collab._id,
        date: { $gte: monthStart, $lte: monthEnd },
      }).lean()
      const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
      const util = calculateUtilization(totalHours, collab.monthlyCapacityH)

      if (util > 120) {
        recommendations.push(
          `🚨 ${collab.name} is critically overloaded at ${util.toFixed(1)}% utilization. Immediate action required.`
        )
      } else if (util > 100) {
        recommendations.push(
          `⚠️ ${collab.name} is overloaded at ${util.toFixed(1)}% utilization. Consider redistributing tasks.`
        )
      }
    }

    // Check late projects
    const projects = await Project.find({ status: { $ne: 'DONE' } }).lean()

    for (const project of projects) {
      if (isLate(project.plannedDelivery, project.status)) {
        recommendations.push(
          `📅 Project "${project.name}" is past its planned delivery date. Status: ${project.status}.`
        )
      }
    }

    // Check high support load
    const monthEntries = await TimeEntry.find({
      date: { $gte: monthStart, $lte: monthEnd },
    }).lean()
    const totalHours = monthEntries.reduce((sum, e) => sum + e.hours, 0)
    const supportHours = monthEntries
      .filter((e) => e.isSupport)
      .reduce((sum, e) => sum + e.hours, 0)

    if (totalHours > 0) {
      const supportPct = Math.round((supportHours / totalHours) * 100)
      if (supportPct > 30) {
        recommendations.push(
          `🔧 Support work is ${supportPct}% of total effort this month. Review if project work is being impacted.`
        )
      }
    }

    // Check blocked projects
    const blockedProjects = projects.filter((p) => p.status === 'BLOCKED')
    if (blockedProjects.length > 0) {
      recommendations.push(
        `🚫 ${blockedProjects.length} project(s) are currently blocked. Review and resolve blockers.`
      )
    }

    // Check critical priority projects
    const criticalProjects = projects.filter((p) => p.priority === 'CRITICAL')
    if (criticalProjects.length > 0) {
      recommendations.push(
        `🔴 ${criticalProjects.length} project(s) have CRITICAL priority. Ensure they have adequate resources.`
      )
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Everything looks good! No immediate actions needed.')
    }

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
