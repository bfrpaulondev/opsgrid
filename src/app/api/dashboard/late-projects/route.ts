import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { isLate } from '@/lib/business-rules'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    const projects = await db.project.findMany({
      where: { status: { not: 'DONE' } },
      include: {
        macros: true,
        _count: { select: { entries: true } },
      },
    })

    const late = projects
      .filter((p) => isLate(p.plannedDelivery, p.status))
      .map((p) => ({
        id: p.id,
        name: p.name,
        client: p.client,
        type: p.type,
        priority: p.priority,
        status: p.status,
        plannedDelivery: p.plannedDelivery,
        riskNotes: p.riskNotes,
        macroCount: p.macros.length,
        entryCount: p._count.entries,
      }))

    // Sort by priority (CRITICAL first)
    const priorityOrder: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    }
    late.sort(
      (a, b) =>
        (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99)
    )

    return NextResponse.json({ lateProjects: late })
  } catch (error) {
    console.error('Late projects error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
