import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { calculateUtilization } from '@/lib/business-rules'
import { impactPreviewSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const body = await request.json()
    const parsed = impactPreviewSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { collaboratorId, month, hours } = parsed.data
    const [yearStr, monthPart] = month.split('-')
    const year = parseInt(yearStr)
    const monthNum = parseInt(monthPart) - 1
    const monthStart = new Date(year, monthNum, 1)
    const monthEnd = new Date(year, monthNum + 1, 0, 23, 59, 59)

    const collaborator = await db.collaborator.findUnique({
      where: { id: collaboratorId },
    })

    if (!collaborator) {
      return NextResponse.json(
        { message: 'Collaborator not found' },
        { status: 404 }
      )
    }

    // Current hours for the month
    const entries = await db.timeEntry.findMany({
      where: {
        collaboratorId,
        date: { gte: monthStart, lte: monthEnd },
      },
      include: {
        project: { select: { id: true, name: true, type: true } },
      },
    })

    const currentHours = entries.reduce((sum, e) => sum + e.hours, 0)
    const capacity = collaborator.monthlyCapacityH
    const projectedHours = currentHours + hours
    const utilizationPct = calculateUtilization(projectedHours, capacity)
    const isOverloaded = utilizationPct > 100

    // Current projects
    const currentProjects = [
      ...new Map(
        entries.map((e) => [
          e.projectId,
          {
            id: e.projectId,
            name: e.project.name,
            type: e.project.type,
            hours: 0,
          },
        ])
      ).values(),
    ]

    // Sum hours per project
    for (const entry of entries) {
      const proj = currentProjects.find((p) => p.id === entry.projectId)
      if (proj) proj.hours += entry.hours
    }

    // Suggestion
    let suggestion = ''
    if (isOverloaded) {
      const excessHours = projectedHours - capacity
      suggestion = `Adding ${hours}h would exceed capacity by ${excessHours.toFixed(1)}h. Consider delegating or postponing non-critical tasks.`
    } else if (utilizationPct > 80) {
      suggestion = `Adding ${hours}h would bring utilization to ${utilizationPct.toFixed(1)}%. Approaching capacity - monitor closely.`
    } else {
      suggestion = `Adding ${hours}h is within capacity. Utilization would be ${utilizationPct.toFixed(1)}%.`
    }

    return NextResponse.json({
      collaboratorId,
      collaboratorName: collaborator.name,
      month,
      currentHours: Math.round(currentHours * 100) / 100,
      capacity,
      projectedHours: Math.round(projectedHours * 100) / 100,
      utilizationPct,
      isOverloaded,
      currentProjects: currentProjects.map((p) => ({
        ...p,
        hours: Math.round(p.hours * 100) / 100,
      })),
      suggestion,
    })
  } catch (error) {
    console.error('Impact preview error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
