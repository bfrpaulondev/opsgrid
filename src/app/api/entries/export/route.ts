import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { TimeEntry } from '@/models/TimeEntry'
import { Project } from '@/models/Project'
import { MacroActivity } from '@/models/MacroActivity'
import { Collaborator } from '@/models/Collaborator'
import { requireAuth } from '@/lib/api-auth'

// Portuguese labels for status
const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não Iniciado',
  IN_PROGRESS: 'Em Curso',
  TRIAGE: 'Triagem',
  BLOCKED: 'Bloqueado',
  DONE: 'Concluído',
}

// CSV escape helper - handles commas, quotes, newlines
function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// Format date as DD/MM/YYYY
function formatDate(isoDate: Date | string): string {
  const d = new Date(isoDate)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (!authResult.success) return authResult.response

    await connectDB()

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const collaboratorId = searchParams.get('collaboratorId')
    const projectId = searchParams.get('projectId')

    const filter: Record<string, unknown> = {}

    if (from || to) {
      filter.date = {}
      if (from) (filter.date as Record<string, unknown>).$gte = new Date(from)
      if (to) (filter.date as Record<string, unknown>).$lte = new Date(to)
    }
    if (collaboratorId) filter.collaboratorId = collaboratorId
    if (projectId) filter.projectId = projectId

    const entries = await TimeEntry.find(filter).sort({ date: 1 }).lean()

    // Batch lookup for related data
    const projectIds = [...new Set(entries.map((e) => e.projectId.toString()))]
    const macroIds = [...new Set(entries.filter((e) => e.macroId).map((e) => e.macroId!.toString()))]
    const collabIds = [...new Set(entries.map((e) => e.collaboratorId.toString()))]

    const [projects, macros, collaborators] = await Promise.all([
      Project.find({ _id: { $in: projectIds } }).select('name code type').lean(),
      MacroActivity.find({ _id: { $in: macroIds } }).select('name').lean(),
      Collaborator.find({ _id: { $in: collabIds } }).select('name role department').lean(),
    ])

    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]))
    const macroMap = new Map(macros.map((m) => [m._id.toString(), m]))
    const collaboratorMap = new Map(collaborators.map((c) => [c._id.toString(), c]))

    // Build enriched row data
    const rows = entries.map((e) => {
      const project = projectMap.get(e.projectId.toString())
      const macro = e.macroId ? macroMap.get(e.macroId.toString()) : null
      const collaborator = collaboratorMap.get(e.collaboratorId.toString())
      return {
        date: formatDate(e.date),
        dateSort: new Date(e.date).toISOString().split('T')[0],
        projectCode: project?.code || '',
        projectName: project?.name || '',
        projectType: project?.type || '',
        macroName: macro?.name || '',
        collaboratorName: collaborator?.name || '',
        collaboratorRole: collaborator?.role || '',
        collaboratorDept: collaborator?.department || '',
        hours: e.hours,
        isSupport: e.isSupport ? 'Sim' : 'Não',
        status: STATUS_LABELS[e.statusSnapshot] || e.statusSnapshot,
        progress: e.progressSnapshot != null ? `${e.progressSnapshot}%` : '',
        note: e.note || '',
      }
    })

    // Calculate totals
    const totalHours = rows.reduce((sum, r) => sum + r.hours, 0)
    const supportHours = entries.filter((e) => e.isSupport).reduce((sum, e) => sum + e.hours, 0)
    const projectHours = totalHours - supportHours

    // Generate date range string for filename
    const dateRange = from && to ? `_${from}_${to}` : from ? `_desde_${from}` : to ? `_ate_${to}` : ''
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

    if (format === 'xlsx') {
      return await generateXLSX(rows, totalHours, supportHours, projectHours, timestamp, dateRange)
    }

    return generateCSV(rows, totalHours, supportHours, projectHours, timestamp, dateRange)
  } catch (error) {
    console.error('Export entries error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface ExportRow {
  date: string
  dateSort: string
  projectCode: string
  projectName: string
  projectType: string
  macroName: string
  collaboratorName: string
  collaboratorRole: string
  collaboratorDept: string
  hours: number
  isSupport: string
  status: string
  progress: string
  note: string
}

function generateCSV(
  rows: ExportRow[],
  totalHours: number,
  supportHours: number,
  projectHours: number,
  timestamp: string,
  dateRange: string
) {
  // UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF'

  const headers = [
    'Data',
    'Código Projeto',
    'Projeto',
    'Tipo Projeto',
    'Macro Atividade',
    'Colaborador',
    'Função',
    'Departamento',
    'Horas',
    'Suporte',
    'Status',
    'Progresso',
    'Nota',
  ]

  const headerLine = headers.map(csvEscape).join(';')

  const dataLines = rows.map((r) =>
    [
      r.date,
      r.projectCode,
      r.projectName,
      r.projectType,
      r.macroName,
      r.collaboratorName,
      r.collaboratorRole,
      r.collaboratorDept,
      r.hours,
      r.isSupport,
      r.status,
      r.progress,
      r.note,
    ]
      .map(csvEscape)
      .join(';')
  )

  // Summary section
  const summaryLines = [
    '',
    '--- RESUMO ---',
    `Total de Registos;${rows.length}`,
    `Total de Horas;${totalHours}`,
    `Horas Projeto;${projectHours}`,
    `Horas Suporte;${supportHours}`,
    `Exportado em;${formatDate(new Date())}`,
  ]

  const csv = BOM + [headerLine, ...dataLines, ...summaryLines].join('\r\n')

  const filename = `opsgrid_lancamentos${dateRange}_${timestamp}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}

async function generateXLSX(
  rows: ExportRow[],
  totalHours: number,
  supportHours: number,
  projectHours: number,
  timestamp: string,
  dateRange: string
) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'OpsGrid'
  workbook.created = new Date()

  // ============ SHEET 1: Lançamentos ============
  const ws = workbook.addWorksheet('Lançamentos', {
    properties: { defaultColWidth: 16 },
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  // Define columns with widths
  ws.columns = [
    { header: 'Data', key: 'date', width: 13 },
    { header: 'Código Projeto', key: 'projectCode', width: 16 },
    { header: 'Projeto', key: 'projectName', width: 28 },
    { header: 'Tipo', key: 'projectType', width: 14 },
    { header: 'Macro Atividade', key: 'macroName', width: 22 },
    { header: 'Colaborador', key: 'collaboratorName', width: 24 },
    { header: 'Função', key: 'collaboratorRole', width: 22 },
    { header: 'Departamento', key: 'collaboratorDept', width: 18 },
    { header: 'Horas', key: 'hours', width: 10 },
    { header: 'Suporte', key: 'isSupport', width: 10 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Progresso', key: 'progress', width: 12 },
    { header: 'Nota', key: 'note', width: 30 },
  ]

  // Style header row
  const headerRow = ws.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: 'FFFFFFFF' },
      size: 11,
      name: 'Calibri',
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1B2838' }, // dark navy - ops style
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF00D4FF' } }, // cyan accent
    }
  })

  // Status color map for row cells
  const statusColors: Record<string, string> = {
    'Não Iniciado': 'FFA1A1AA', // zinc
    'Em Curso': 'FF22D3EE',     // cyan
    'Triagem': 'FFF59E0B',      // amber
    'Bloqueado': 'FFEF4444',    // red
    'Concluído': 'FF10B981',    // emerald
  }

  // Add data rows
  rows.forEach((r, idx) => {
    const row = ws.addRow({
      date: r.date,
      projectCode: r.projectCode,
      projectName: r.projectName,
      projectType: r.projectType,
      macroName: r.macroName,
      collaboratorName: r.collaboratorName,
      collaboratorRole: r.collaboratorRole,
      collaboratorDept: r.collaboratorDept,
      hours: r.hours,
      isSupport: r.isSupport,
      status: r.status,
      progress: r.progress,
      note: r.note,
    })

    row.height = 22

    // Alternate row colors
    const isEven = idx % 2 === 0
    const rowBg = isEven ? 'FFF8FAFC' : 'FFEEF2F7' // very light alternating

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: rowBg },
      }
      cell.alignment = { vertical: 'middle' }

      // Cell borders
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }

      // Specific column formatting
      if (colNumber === 1) {
        // Date - center aligned
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
      if (colNumber === 9) {
        // Hours - right aligned, bold, cyan accent
        cell.font = { size: 10, name: 'Calibri', bold: true, color: { argb: 'FF0891B2' } }
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      }
      if (colNumber === 10) {
        // Suporte column
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (r.isSupport === 'Sim') {
          cell.font = { size: 10, name: 'Calibri', bold: true, color: { argb: 'FFF59E0B' } }
        }
      }
      if (colNumber === 11) {
        // Status column - color-coded
        const statusColor = statusColors[r.status]
        if (statusColor) {
          cell.font = { size: 10, name: 'Calibri', bold: true, color: { argb: statusColor } }
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
      if (colNumber === 12) {
        // Progress - center aligned
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }
    })
  })

  // ============ TOTALS ROW ============
  const totalRowIndex = rows.length + 2 // +1 header, +1 empty row
  ws.addRow({}) // empty separator row

  const totalRow = ws.addRow({
    date: '',
    projectCode: '',
    projectName: '',
    projectType: '',
    macroName: '',
    collaboratorName: '',
    collaboratorDept: '',
    hours: totalHours,
    isSupport: '',
    status: 'TOTAL',
    progress: '',
    note: '',
  })
  totalRow.height = 26

  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { size: 11, name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // dark background
    }
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF00D4FF' } },
      bottom: { style: 'medium', color: { argb: 'FF00D4FF' } },
    }
    if (colNumber === 9) {
      cell.font = { size: 12, name: 'Calibri', bold: true, color: { argb: 'FF00D4FF' } }
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
    }
    if (colNumber === 11) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
  })

  // ============ SHEET 2: Resumo ============
  const wsSummary = workbook.addWorksheet('Resumo', {
    properties: { defaultColWidth: 22 },
  })

  // Title
  wsSummary.mergeCells('A1:D1')
  const titleCell = wsSummary.getCell('A1')
  titleCell.value = 'OPSGRID - Relatório de Lançamentos'
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF00D4FF' }, name: 'Calibri' }
  titleCell.alignment = { vertical: 'middle' }
  wsSummary.getRow(1).height = 36

  // Subtitle with export date
  wsSummary.mergeCells('A2:D2')
  const subCell = wsSummary.getCell('A2')
  subCell.value = `Exportado em ${formatDate(new Date())}`
  subCell.font = { size: 10, color: { argb: 'FF94A3B8' }, name: 'Calibri' }
  wsSummary.getRow(2).height = 20

  // Summary cards
  const summaryData = [
    { label: 'Total de Registos', value: rows.length, icon: '' },
    { label: 'Total de Horas', value: totalHours, icon: '' },
    { label: 'Horas de Projeto', value: projectHours, icon: '' },
    { label: 'Horas de Suporte', value: supportHours, icon: '' },
  ]

  let rowIdx = 4
  summaryData.forEach((item) => {
    const labelCell = wsSummary.getCell(`A${rowIdx}`)
    labelCell.value = item.label
    labelCell.font = { size: 11, color: { argb: 'FF64748B' }, name: 'Calibri' }

    const valueCell = wsSummary.getCell(`B${rowIdx}`)
    valueCell.value = item.value
    valueCell.font = { size: 14, bold: true, color: { argb: 'FF00D4FF' }, name: 'Calibri' }

    wsSummary.getRow(rowIdx).height = 26
    rowIdx++
  })

  // Per-collaborator breakdown
  rowIdx += 2
  const collabCell = wsSummary.getCell(`A${rowIdx}`)
  collabCell.value = 'Horas por Colaborador'
  collabCell.font = { size: 13, bold: true, color: { argb: 'FFE2E8F0' }, name: 'Calibri' }
  wsSummary.getRow(rowIdx).height = 28
  rowIdx++

  // Collaborator breakdown header
  const collabHeaderRow = wsSummary.getRow(rowIdx)
  collabHeaderRow.getCell(1).value = 'Colaborador'
  collabHeaderRow.getCell(2).value = 'Função'
  collabHeaderRow.getCell(3).value = 'Horas Projeto'
  collabHeaderRow.getCell(4).value = 'Horas Suporte'
  collabHeaderRow.getCell(5).value = 'Total'
  collabHeaderRow.eachCell((cell) => {
    cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2838' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  rowIdx++

  // Group by collaborator
  const collabMap = new Map<string, { name: string; role: string; projectH: number; supportH: number }>()
  rows.forEach((r) => {
    if (!collabMap.has(r.collaboratorName)) {
      collabMap.set(r.collaboratorName, { name: r.collaboratorName, role: r.collaboratorRole, projectH: 0, supportH: 0 })
    }
    const c = collabMap.get(r.collaboratorName)!
    if (r.isSupport === 'Sim') {
      c.supportH += r.hours
    } else {
      c.projectH += r.hours
    }
  })

  collabMap.forEach((c) => {
    const dataRow = wsSummary.getRow(rowIdx)
    dataRow.getCell(1).value = c.name
    dataRow.getCell(2).value = c.role
    dataRow.getCell(3).value = c.projectH
    dataRow.getCell(4).value = c.supportH
    dataRow.getCell(5).value = c.projectH + c.supportH

    dataRow.getCell(3).font = { size: 10, name: 'Calibri', color: { argb: 'FF0891B2' } }
    dataRow.getCell(4).font = { size: 10, name: 'Calibri', color: { argb: 'FFF59E0B' } }
    dataRow.getCell(5).font = { size: 10, name: 'Calibri', bold: true, color: { argb: 'FF00D4FF' } }

    dataRow.eachCell((cell) => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    })
    rowIdx++
  })

  // Per-project breakdown
  rowIdx += 2
  const projTitleCell = wsSummary.getCell(`A${rowIdx}`)
  projTitleCell.value = 'Horas por Projeto'
  projTitleCell.font = { size: 13, bold: true, color: { argb: 'FFE2E8F0' }, name: 'Calibri' }
  wsSummary.getRow(rowIdx).height = 28
  rowIdx++

  const projHeaderRow = wsSummary.getRow(rowIdx)
  projHeaderRow.getCell(1).value = 'Projeto'
  projHeaderRow.getCell(2).value = 'Código'
  projHeaderRow.getCell(3).value = 'Tipo'
  projHeaderRow.getCell(4).value = 'Total Horas'
  projHeaderRow.eachCell((cell) => {
    cell.font = { size: 10, bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2838' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  rowIdx++

  // Group by project
  const projMap = new Map<string, { name: string; code: string; type: string; totalH: number }>()
  rows.forEach((r) => {
    const key = r.projectName
    if (!projMap.has(key)) {
      projMap.set(key, { name: r.projectName, code: r.projectCode, type: r.projectType, totalH: 0 })
    }
    projMap.get(key)!.totalH += r.hours
  })

  projMap.forEach((p) => {
    const dataRow = wsSummary.getRow(rowIdx)
    dataRow.getCell(1).value = p.name
    dataRow.getCell(2).value = p.code
    dataRow.getCell(3).value = p.type
    dataRow.getCell(4).value = p.totalH
    dataRow.getCell(4).font = { size: 10, name: 'Calibri', bold: true, color: { argb: 'FF00D4FF' } }
    dataRow.eachCell((cell) => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
    })
    rowIdx++
  })

  // Set column widths for summary sheet
  wsSummary.getColumn(1).width = 28
  wsSummary.getColumn(2).width = 22
  wsSummary.getColumn(3).width = 18
  wsSummary.getColumn(4).width = 18
  wsSummary.getColumn(5).width = 14

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()

  const filename = `opsgrid_lancamentos${dateRange}_${timestamp}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}
