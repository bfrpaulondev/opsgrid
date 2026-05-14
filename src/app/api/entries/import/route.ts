import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TimeEntry } from '@/models/TimeEntry'
import { requireAuth } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { message: 'No file provided' },
        { status: 400 }
      )
    }

    const text = await file.text()
    const lines = text.split('\n').filter((line) => line.trim())

    if (lines.length < 2) {
      return NextResponse.json(
        { message: 'CSV file must have header and at least one data row' },
        { status: 400 }
      )
    }

    const header = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
    const requiredColumns = ['date', 'projectId', 'collaboratorId', 'hours']
    const missingColumns = requiredColumns.filter(
      (col) => !header.includes(col)
    )

    if (missingColumns.length > 0) {
      return NextResponse.json(
        { message: `Missing required columns: ${missingColumns.join(', ')}` },
        { status: 400 }
      )
    }

    const colIndex: Record<string, number> = {}
    header.forEach((col, idx) => {
      colIndex[col] = idx
    })

    const created = []
    const errors = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''))

      try {
        const dateStr = values[colIndex['date']]
        const projectId = values[colIndex['projectId']]
        const collaboratorId = values[colIndex['collaboratorId']]
        const hours = parseFloat(values[colIndex['hours']])

        if (!dateStr || !projectId || !collaboratorId || isNaN(hours)) {
          errors.push({ row: i + 1, error: 'Missing required fields' })
          continue
        }

        const macroId = colIndex['macroId'] !== undefined
          ? values[colIndex['macroId']] || null
          : null
        const isSupport = colIndex['isSupport'] !== undefined
          ? values[colIndex['isSupport']] === 'true'
          : false
        const statusSnapshot = colIndex['statusSnapshot'] !== undefined
          ? values[colIndex['statusSnapshot']] || 'IN_PROGRESS'
          : 'IN_PROGRESS'
        const progressSnapshot = colIndex['progressSnapshot'] !== undefined
          ? values[colIndex['progressSnapshot']]
            ? parseFloat(values[colIndex['progressSnapshot']])
            : null
          : null
        const note = colIndex['note'] !== undefined
          ? values[colIndex['note']] || null
          : null

        const entry = await TimeEntry.create({
          date: new Date(dateStr),
          projectId,
          macroId,
          collaboratorId,
          hours,
          isSupport,
          statusSnapshot,
          progressSnapshot,
          note,
        })

        created.push({ ...entry.toObject(), id: entry._id.toString() })
      } catch (err) {
        errors.push({
          row: i + 1,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      imported: created.length,
      errors: errors.length,
      errorDetails: errors,
    })
  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
