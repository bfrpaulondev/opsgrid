import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { calculateUtilization, isLate } from '@/lib/business-rules'

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

    // Active collaborators
    const activeCollaborators = await db.collaborator.findMany({
      where: { active: true },
    })
    const totalActiveItems = activeCollaborators.length

    // Time entries for the month
    const entries = await db.timeEntry.findMany({
      where: {
        date: { gte: monthStart, lte: monthEnd },
      },
      include: {
        project: { select: { id: true, name: true, type: true } },
        collaborator: { select: { id: true, name: true, monthlyCapacityH: true } },
      },
    })

    const actualHoursMonth = entries.reduce((sum, e) => sum + e.hours, 0)

    // Planned allocations for the month
    const allocations = await db.plannedAllocation.findMany({
      where: { month: monthStr },
    })
    const plannedHoursMonth = allocations.reduce(
      (sum, a) => sum + a.plannedHours,
      0
    )

    // Overloaded collaborators
    const collaboratorHours = new Map<
      string,
      { total: number; capacity: number; name: string }
    >()

    for (const entry of entries) {
      const existing = collaboratorHours.get(entry.collaboratorId) || {
        total: 0,
        capacity: entry.collaborator.monthlyCapacityH,
        name: entry.collaborator.name,
      }
      existing.total += entry.hours
      collaboratorHours.set(entry.collaboratorId, existing)
    }

    const overloadedCollaboratorsList = []
    for (const [id, data] of collaboratorHours) {
      const util = calculateUtilization(data.total, data.capacity)
      if (util > 100) {
        overloadedCollaboratorsList.push({
          id,
          name: data.name,
          totalHours: Math.round(data.total * 100) / 100,
          capacity: data.capacity,
          utilizationPct: util,
        })
      }
    }
    const overloadedCollaborators = overloadedCollaboratorsList.length

    // Top projects by hours
    const projectHours = new Map<string, { name: string; hours: number }>()
    for (const entry of entries) {
      const existing = projectHours.get(entry.projectId) || {
        name: entry.project.name,
        hours: 0,
      }
      existing.hours += entry.hours
      projectHours.set(entry.projectId, existing)
    }

    const topProjectsByHours = Array.from(projectHours.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)

    // Late projects
    const projects = await db.project.findMany({
      where: { status: { not: 'DONE' } },
    })
    const lateProjects = projects
      .filter((p) => isLate(p.plannedDelivery, p.status))
      .map((p) => ({
        id: p.id,
        name: p.name,
        plannedDelivery: p.plannedDelivery,
        status: p.status,
      }))

    // Effort by type
    const effortByType: Record<string, number> = {}
    for (const entry of entries) {
      const type = entry.project.type
      effortByType[type] = (effortByType[type] || 0) + entry.hours
    }

    // Simple recommendations
    const recommendations: string[] = []

    if (overloadedCollaborators > 0) {
      recommendations.push(
        `${overloadedCollaborators} collaborator(s) are overloaded this month. Consider redistributing work.`
      )
    }

    if (lateProjects.length > 0) {
      recommendations.push(
        `${lateProjects.length} project(s) are past their planned delivery date. Review priorities.`
      )
    }

    const supportHours = entries
      .filter((e) => e.isSupport)
      .reduce((sum, e) => sum + e.hours, 0)
    const supportPct =
      actualHoursMonth > 0
        ? Math.round((supportHours / actualHoursMonth) * 100)
        : 0

    if (supportPct > 30) {
      recommendations.push(
        `Support work represents ${supportPct}% of total effort. Consider if support load can be reduced.`
      )
    }

    if (recommendations.length === 0) {
      recommendations.push('Everything looks good this month!')
    }

    return NextResponse.json({
      month: monthStr,
      totalActiveItems,
      plannedHoursMonth: Math.round(plannedHoursMonth * 100) / 100,
      actualHoursMonth: Math.round(actualHoursMonth * 100) / 100,
      overloadedCollaborators,
      topProjectsByHours,
      overloadedCollaboratorsList,
      lateProjects,
      effortByType,
      recommendations,
    })
  } catch (error) {
    console.error('Dashboard overview error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
