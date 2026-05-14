import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { Project } from '@/models/Project'
import { MacroActivity } from '@/models/MacroActivity'
import { requireLeader } from '@/lib/api-auth'
import { macroCreateSchema } from '@/lib/validations'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireLeader(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { id } = await params

    const project = await Project.findById(id)
    if (!project) {
      return NextResponse.json(
        { message: 'Project not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = macroCreateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data: Record<string, unknown> = {
      ...parsed.data,
      projectId: id,
    }

    if (data.plannedDelivery)
      data.plannedDelivery = new Date(data.plannedDelivery as string)

    const macro = await MacroActivity.create(data)

    return NextResponse.json(
      { ...macro.toObject(), id: macro._id.toString() },
      { status: 201 }
    )
  } catch (error) {
    console.error('Create macro error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
