'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  FolderKanban,
  Target,
  Clock,
  AlertTriangle,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { format, subMonths, addMonths, differenceInDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { AppLayout } from '@/components/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api } from '@/lib/api-client'
import { getUtilizationColor } from '@/lib/business-rules'

interface DashboardOverview {
  month: string
  totalActiveItems: number
  plannedHoursMonth: number
  actualHoursMonth: number
  overloadedCollaborators: number
  topProjectsByHours: { id: string; name: string; hours: number }[]
  overloadedCollaboratorsList: {
    id: string
    name: string
    totalHours: number
    capacity: number
    utilizationPct: number
  }[]
  lateProjects: {
    id: string
    name: string
    plannedDelivery: string
    status: string
  }[]
  effortByType: Record<string, number>
  recommendations: string[]
}

const TYPE_COLORS: Record<string, string> = {
  PROJECT: '#22d3ee',
  MACRO: '#10b981',
  INCIDENT: '#f59e0b',
  REQUEST: '#8b5cf6',
}

const TYPE_LABELS: Record<string, string> = {
  PROJECT: 'Projeto',
  MACRO: 'Macro',
  INCIDENT: 'Incidente',
  REQUEST: 'Pedido',
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Não Iniciado',
  IN_PROGRESS: 'Em Curso',
  TRIAGE: 'Triagem',
  BLOCKED: 'Bloqueado',
  DONE: 'Concluído',
}

function UtilizationBar({ pct, name }: { pct: number; name: string }) {
  const color = getUtilizationColor(pct)
  const barColor =
    color === 'green'
      ? 'bg-ops-success'
      : color === 'yellow'
        ? 'bg-ops-warning'
        : 'bg-ops-danger'
  const textColor =
    color === 'green'
      ? 'text-ops-success'
      : color === 'yellow'
        ? 'text-ops-warning'
        : 'text-ops-danger'

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-36 shrink-0 truncate text-sm text-foreground">{name}</div>
      <div className="flex-1">
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(pct, 150)}%` }}
          />
        </div>
      </div>
      <div className={`w-16 shrink-0 text-right ops-mono text-sm font-bold ${textColor}`}>
        {pct.toFixed(0)}%
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const monthStr = format(selectedDate, 'yyyy-MM')

  const { data, isLoading } = useQuery<DashboardOverview>({
    queryKey: ['dashboard-overview', monthStr],
    queryFn: () => api.get('/dashboard/overview', { month: monthStr }),
  })

  const pieData = useMemo(() => {
    if (!data?.effortByType) return []
    return Object.entries(data.effortByType).map(([type, hours]) => ({
      name: TYPE_LABELS[type] || type,
      type,
      hours: Math.round(hours * 100) / 100,
    }))
  }, [data])

  const barData = useMemo(() => {
    if (!data?.topProjectsByHours) return []
    return [...data.topProjectsByHours].reverse().map((p) => ({
      name: p.name.length > 25 ? p.name.slice(0, 22) + '...' : p.name,
      hours: Math.round(p.hours * 100) / 100,
    }))
  }, [data])

  const monthLabel = format(selectedDate, 'MMMM yyyy', { locale: ptBR })

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header with Month Selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard Gerencial</h1>
            <p className="ops-label mt-1">Vista geral operacional</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border"
              onClick={() => setSelectedDate((d) => subMonths(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
              <Calendar className="h-4 w-4 text-ops-accent" />
              <span className="ops-mono text-sm capitalize">{monthLabel}</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-border"
              onClick={() => setSelectedDate((d) => addMonths(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Top Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-border bg-card ops-glow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="ops-label mb-1">Total Itens Ativos</p>
                      <p className="ops-mono text-3xl font-bold text-foreground">
                        {data?.totalActiveItems ?? 0}
                      </p>
                    </div>
                    <div className="rounded-lg bg-ops-accent/10 p-2.5">
                      <FolderKanban className="h-5 w-5 text-ops-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card ops-glow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="ops-label mb-1">Horas Previstas (Mês)</p>
                      <p className="ops-mono text-3xl font-bold text-ops-accent">
                        {data?.plannedHoursMonth?.toFixed(1) ?? '0.0'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-ops-accent/10 p-2.5">
                      <Target className="h-5 w-5 text-ops-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card ops-glow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="ops-label mb-1">Horas Realizadas (Mês)</p>
                      <p className="ops-mono text-3xl font-bold text-ops-success">
                        {data?.actualHoursMonth?.toFixed(1) ?? '0.0'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-ops-success/10 p-2.5">
                      <Clock className="h-5 w-5 text-ops-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-card ops-glow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="ops-label mb-1">Colaboradores Sobrecarregados</p>
                      <p
                        className={`ops-mono text-3xl font-bold ${
                          (data?.overloadedCollaborators ?? 0) > 0
                            ? 'text-ops-danger'
                            : 'text-ops-success'
                        }`}
                      >
                        {data?.overloadedCollaborators ?? 0}
                      </p>
                    </div>
                    <div
                      className={`rounded-lg p-2.5 ${
                        (data?.overloadedCollaborators ?? 0) > 0
                          ? 'bg-ops-danger/10'
                          : 'bg-ops-success/10'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-5 w-5 ${
                          (data?.overloadedCollaborators ?? 0) > 0
                            ? 'text-ops-danger'
                            : 'text-ops-success'
                        }`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Bar Chart - Top 5 Projects */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="ops-label text-xs">
                    Top 5 Projetos por Horas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {barData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart
                        data={barData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis
                          type="number"
                          tick={{ fill: '#71717a', fontSize: 11 }}
                          axisLine={{ stroke: '#27272a' }}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fill: '#a1a1aa', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            color: '#fafafa',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${value}h`, 'Horas']}
                        />
                        <Bar dataKey="hours" fill="#22d3ee" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                      Sem dados para este mês
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pie Chart - Distribution by Type */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="ops-label text-xs">
                    Distribuição por Tipo
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="hours"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {pieData.map((entry) => (
                            <Cell
                              key={entry.type}
                              fill={TYPE_COLORS[entry.type] || '#71717a'}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#18181b',
                            border: '1px solid #27272a',
                            borderRadius: '8px',
                            color: '#fafafa',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [`${value}h`, 'Horas']}
                        />
                        <Legend
                          formatter={(value: string) => (
                            <span className="text-xs text-muted-foreground">{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                      Sem dados para este mês
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Bottom Sections */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Overloaded Collaborators */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="ops-label text-xs">
                    Colaboradores Sobrecarregados
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {data?.overloadedCollaboratorsList &&
                  data.overloadedCollaboratorsList.length > 0 ? (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-1">
                        {data.overloadedCollaboratorsList.map((c) => (
                          <UtilizationBar
                            key={c.id}
                            pct={c.utilizationPct}
                            name={c.name}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                      Nenhum colaborador sobrecarregado
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Late Projects */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="ops-label text-xs">Projetos Atrasados</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {data?.lateProjects && data.lateProjects.length > 0 ? (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-3">
                        {data.lateProjects.map((p) => {
                          const deliveryDate = p.plannedDelivery
                            ? parseISO(p.plannedDelivery)
                            : null
                          const daysOverdue = deliveryDate
                            ? differenceInDays(new Date(), deliveryDate)
                            : 0
                          return (
                            <div
                              key={p.id}
                              className="flex items-start gap-3 rounded-md border border-ops-danger/20 bg-ops-danger/5 p-3"
                            >
                              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-ops-danger" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {p.name}
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                  <span className="ops-label text-[0.6rem]">
                                    Previsto:{' '}
                                    {deliveryDate
                                      ? format(deliveryDate, 'dd/MM/yyyy')
                                      : '—'}
                                  </span>
                                  <Badge
                                    variant="destructive"
                                    className="h-4 px-1.5 text-[0.6rem]"
                                  >
                                    {daysOverdue}d atraso
                                  </Badge>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="mt-1 h-4 px-1.5 text-[0.6rem]"
                                >
                                  {STATUS_LABELS[p.status] || p.status}
                                </Badge>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                      Nenhum projeto atrasado
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="ops-label text-xs">
                    Recomendações Automáticas
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {data?.recommendations && data.recommendations.length > 0 ? (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2">
                        {data.recommendations.map((rec, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-3 rounded-md border border-ops-accent/20 bg-ops-accent/5 p-3"
                          >
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ops-accent" />
                            <p className="text-sm text-foreground">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                      Sem recomendações
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
