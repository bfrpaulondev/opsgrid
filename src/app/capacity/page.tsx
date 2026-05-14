'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '@/components/app-layout'
import { api } from '@/lib/api-client'
import { getUtilizationColor, calculateUtilization } from '@/lib/business-rules'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3,
  Users,
  Clock,
} from 'lucide-react'

// Types
interface Collaborator {
  id: string
  name: string
  jobTitle: string | null
  monthlyCapacityH: number
  supportPct: number
  active: boolean
}

interface MonthData {
  month: string
  totalHours: number
  supportHours: number
  projectHours: number
  capacity: number
  utilizationPct: number
}

interface CapacityData {
  collaboratorId: string
  collaboratorName: string
  year: number
  monthlyCapacityH: number
  months: MonthData[]
}

interface EntryItem {
  id: string
  date: string
  hours: number
  isSupport: boolean
  note: string | null
  project: { id: string; name: string; type: string }
}

const monthNames = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export default function CapacityPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedCell, setSelectedCell] = useState<{
    collaboratorId: string
    collaboratorName: string
    month: number
  } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Fetch active collaborators
  const { data: collaborators = [], isLoading: collabsLoading } = useQuery({
    queryKey: ['collaborators-active'],
    queryFn: () =>
      api.get<Collaborator[]>('/collaborators', { active: 'true' }),
  })

  // Fetch capacity for all collaborators
  // We use a query per collaborator for simplicity
  const capacityQueries = useQuery({
    queryKey: ['capacity-all', selectedYear, collaborators.map((c) => c.id).join(',')],
    queryFn: async () => {
      const results: CapacityData[] = []
      for (const collab of collaborators) {
        try {
          const data = await api.get<CapacityData>(
            `/collaborators/${collab.id}/capacity`,
            { year: selectedYear.toString() }
          )
          results.push(data)
        } catch {
          // Skip failed
        }
      }
      return results
    },
    enabled: collaborators.length > 0,
  })

  // Fetch cell detail entries
  const { data: cellEntries = [] } = useQuery({
    queryKey: ['cell-entries', selectedCell?.collaboratorId, selectedCell?.month, selectedYear],
    queryFn: () => {
      if (!selectedCell) return []
      const monthStr = `${selectedYear}-${String(selectedCell.month + 1).padStart(2, '0')}`
      const from = `${monthStr}-01`
      const lastDay = new Date(selectedYear, selectedCell.month + 1, 0).getDate()
      const to = `${monthStr}-${lastDay}`
      return api.get<EntryItem[]>('/entries', {
        collaboratorId: selectedCell.collaboratorId,
        from,
        to,
      })
    },
    enabled: !!selectedCell,
  })

  const capacityData = capacityQueries.data || []

  // Build a map for quick lookup
  const capacityMap = useMemo(() => {
    const map = new Map<string, CapacityData>()
    capacityData.forEach((cd) => map.set(cd.collaboratorId, cd))
    return map
  }, [capacityData])

  // Cell click handler
  function handleCellClick(collabId: string, collabName: string, month: number) {
    setSelectedCell({
      collaboratorId: collabId,
      collaboratorName: collabName,
      month,
    })
    setSheetOpen(true)
  }

  // Get cell background color based on utilization
  function getCellBg(pct: number): string {
    if (pct <= 0) return ''
    if (pct <= 80) return 'bg-emerald-500/15'
    if (pct <= 100) return 'bg-amber-500/15'
    return 'bg-red-500/20'
  }

  function getCellText(pct: number): string {
    if (pct <= 0) return 'text-muted-foreground'
    if (pct <= 80) return 'text-emerald-400'
    if (pct <= 100) return 'text-amber-400'
    return 'text-red-400'
  }

  // Calculate overall support pct from capacity data
  function getYearlySupportPct(cd: CapacityData): number {
    const totalHours = cd.months.reduce((s, m) => s + m.totalHours, 0)
    const supportHours = cd.months.reduce((s, m) => s + m.supportHours, 0)
    if (totalHours === 0) return 0
    return Math.round((supportHours / totalHours) * 10000) / 100
  }

  // Cell detail data
  const cellMonthData = useMemo(() => {
    if (!selectedCell) return null
    const cd = capacityMap.get(selectedCell.collaboratorId)
    if (!cd) return null
    return cd.months[selectedCell.month]
  }, [selectedCell, capacityMap])

  const cellProjectBreakdown = useMemo(() => {
    if (!cellEntries.length) return []
    const map = new Map<string, { name: string; hours: number; supportHours: number }>()
    cellEntries.forEach((e) => {
      const existing = map.get(e.project.id) || {
        name: e.project.name,
        hours: 0,
        supportHours: 0,
      }
      existing.hours += e.hours
      if (e.isSupport) existing.supportHours += e.hours
      map.set(e.project.id, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [cellEntries])

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Capacidade</h1>
            <p className="ops-label mt-1">Análise mensal de capacidade da equipa</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border"
              onClick={() => setSelectedYear((y) => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="ops-mono text-lg font-semibold text-foreground min-w-[60px] text-center">
              {selectedYear}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border"
              onClick={() => setSelectedYear((y) => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-emerald-500/40" />
            <span className="text-muted-foreground">≤ 80%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-amber-500/40" />
            <span className="text-muted-foreground">80-100%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded bg-red-500/40" />
            <span className="text-muted-foreground">&gt; 100%</span>
          </div>
        </div>

        {/* Capacity Matrix */}
        <div className="rounded-lg border border-border bg-card">
          {collabsLoading || capacityQueries.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 ops-label">A carregar capacidade...</span>
            </div>
          ) : collaborators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Nenhum colaborador ativo</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="sticky left-0 z-10 bg-card min-w-[160px]">
                      Colaborador
                    </TableHead>
                    <TableHead className="text-center min-w-[70px]">Capacidade</TableHead>
                    {monthNames.map((m, i) => (
                      <TableHead
                        key={i}
                        className="text-center min-w-[80px]"
                      >
                        {m}
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[80px]">
                      % Suporte
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collaborators.map((collab) => {
                    const cd = capacityMap.get(collab.id)
                    const yearlySupport = cd ? getYearlySupportPct(cd) : 0
                    return (
                      <TableRow
                        key={collab.id}
                        className="border-border hover:bg-muted/30"
                      >
                        <TableCell className="sticky left-0 z-10 bg-card font-medium text-foreground">
                          {collab.name}
                          {collab.jobTitle && (
                            <span className="block text-xs text-muted-foreground font-normal">
                              {collab.jobTitle}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="ops-mono text-sm text-muted-foreground">
                            {collab.monthlyCapacityH}h
                          </span>
                        </TableCell>
                        {Array.from({ length: 12 }).map((_, monthIdx) => {
                          const monthData = cd?.months[monthIdx]
                          const util = monthData?.utilizationPct || 0
                          const hours = monthData?.totalHours || 0
                          return (
                            <TableCell
                              key={monthIdx}
                              className={`text-center cursor-pointer transition-colors hover:brightness-125 ${getCellBg(util)}`}
                              onClick={() =>
                                handleCellClick(collab.id, collab.name, monthIdx)
                              }
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`ops-mono text-xs ${getCellText(util)}`}>
                                  {hours > 0 ? `${hours.toFixed(0)}h` : '—'}
                                </span>
                                {util > 0 && (
                                  <span className={`ops-mono text-[10px] ${getCellText(util)}`}>
                                    {util.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-center">
                          <span className="ops-mono text-sm text-muted-foreground">
                            {yearlySupport > 0 ? `${yearlySupport.toFixed(1)}%` : '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Cell Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => {
        setSheetOpen(open)
        if (!open) setSelectedCell(null)
      }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[480px] bg-card border-border p-0"
        >
          {selectedCell && cellMonthData ? (
            <>
              <SheetHeader className="p-6 pb-4 border-b border-border">
                <SheetTitle className="text-foreground">
                  {selectedCell.collaboratorName}
                </SheetTitle>
                <SheetDescription>
                  {monthNames[selectedCell.month]} {selectedYear} — Detalhe de capacidade
                </SheetDescription>
              </SheetHeader>

              <ScrollArea className="h-[calc(100vh-140px)]">
                <div className="p-6 space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-md border border-border bg-background p-3">
                      <span className="ops-label block mb-1">Horas Totais</span>
                      <span className="ops-mono text-xl text-foreground">
                        {cellMonthData.totalHours.toFixed(1)}h
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-background p-3">
                      <span className="ops-label block mb-1">Utilização</span>
                      <span className={`ops-mono text-xl ${getCellText(cellMonthData.utilizationPct)}`}>
                        {cellMonthData.utilizationPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-background p-3">
                      <span className="ops-label block mb-1">Horas Projeto</span>
                      <span className="ops-mono text-xl text-foreground">
                        {cellMonthData.projectHours.toFixed(1)}h
                      </span>
                    </div>
                    <div className="rounded-md border border-border bg-background p-3">
                      <span className="ops-label block mb-1">Horas Suporte</span>
                      <span className="ops-mono text-xl text-foreground">
                        {cellMonthData.supportHours.toFixed(1)}h
                      </span>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="rounded-md border border-border bg-background p-4">
                    <span className="ops-label block mb-2">Capacidade</span>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            cellMonthData.utilizationPct <= 80
                              ? 'bg-ops-success'
                              : cellMonthData.utilizationPct <= 100
                              ? 'bg-ops-warning'
                              : 'bg-ops-danger'
                          }`}
                          style={{
                            width: `${Math.min(cellMonthData.utilizationPct, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="ops-mono text-sm text-muted-foreground">
                        {cellMonthData.totalHours.toFixed(0)}/{cellMonthData.capacity}h
                      </span>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  {/* Project Breakdown */}
                  <div>
                    <span className="ops-label block mb-3">Distribuição por Projeto</span>
                    {cellProjectBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Sem lançamentos neste mês
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {cellProjectBreakdown.map((proj) => (
                          <div
                            key={proj.name}
                            className="flex items-center justify-between rounded-md border border-border p-3 bg-background"
                          >
                            <div className="flex-1">
                              <span className="text-sm font-medium text-foreground">
                                {proj.name}
                              </span>
                              {proj.supportHours > 0 && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30"
                                >
                                  {proj.supportHours.toFixed(1)}h suporte
                                </Badge>
                              )}
                            </div>
                            <span className="ops-mono text-sm text-foreground">
                              {proj.hours.toFixed(1)}h
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  )
}
