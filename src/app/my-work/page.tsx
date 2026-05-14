'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/app-layout'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { calculateUtilization } from '@/lib/business-rules'
import { StatusBadge } from '@/components/status-badge'
import { UtilizationBar } from '@/components/utilization-bar'
import { toast } from 'sonner'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import {
  Clock,
  Briefcase,
  TrendingUp,
  Plus,
  Loader2,
  CalendarDays,
  FileText,
} from 'lucide-react'

// Types
interface ProjectEntry {
  id: string
  date: string
  hours: number
  isSupport: boolean
  note: string | null
  statusSnapshot: string
  project: { id: string; name: string; type: string; status: string }
  macro: { id: string; name: string } | null
  collaborator: { id: string; name: string }
}

interface Allocation {
  id: string
  projectId: string
  collaboratorId: string
  month: string
  plannedHours: number
  project: { id: string; name: string; type: string; status: string }
  collaborator: { id: string; name: string; monthlyCapacityH: number }
}

interface Collaborator {
  id: string
  name: string
  jobTitle: string | null
  monthlyCapacityH: number
  supportPct: number
  active: boolean
}

export default function MyWorkPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')
  const currentMonth = format(now, 'yyyy-MM')

  // Time entry dialog
  const [showEntryDialog, setShowEntryDialog] = useState(false)
  const [entryForm, setEntryForm] = useState({
    date: format(now, 'yyyy-MM-dd'),
    hours: 8,
    note: '',
    isSupport: false,
    projectId: '',
  })

  // Fetch collaborator profile
  const { data: collaborators } = useQuery({
    queryKey: ['my-collaborator'],
    queryFn: () => api.get<Collaborator[]>('/collaborators', { active: 'true' }),
    enabled: !!user?.collaboratorId,
  })

  const collaboratorId = user?.collaboratorId
  const myCollaborator = useMemo(() => {
    if (!collaborators || !collaboratorId) return null
    return collaborators.find((c) => c.id === collaboratorId) || null
  }, [collaborators, collaboratorId])

  // Fetch my entries this month
  const { data: myEntries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['my-entries', user?.collaboratorId, monthStart],
    queryFn: () =>
      api.get<ProjectEntry[]>('/entries', {
        collaboratorId: user!.collaboratorId!,
        from: monthStart,
        to: monthEnd,
      }),
    enabled: !!user?.collaboratorId,
  })

  // Fetch my allocations this month
  const { data: allAllocations = [] } = useQuery({
    queryKey: ['my-allocations', currentMonth],
    queryFn: () =>
      api.get<Allocation[]>('/allocations', { month: currentMonth }),
    enabled: !!user?.collaboratorId,
  })

  const myAllocations = useMemo(
    () => allAllocations.filter((a) => a.collaboratorId === user?.collaboratorId),
    [allAllocations, user?.collaboratorId]
  )

  // Fetch all projects for the entry form
  const { data: projects = [] } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => api.get<Array<{ id: string; name: string }>>('/projects'),
  })

  // Create time entry mutation
  const createEntryMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/entries', data),
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['my-entries'] })
      toast.success('Tempo registado com sucesso')
      setEntryForm({
        date: format(now, 'yyyy-MM-dd'),
        hours: 8,
        note: '',
        isSupport: false,
        projectId: '',
      })
      setShowEntryDialog(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Calculations
  const totalHoursThisMonth = useMemo(
    () => myEntries.reduce((sum, e) => sum + e.hours, 0),
    [myEntries]
  )

  const supportHoursThisMonth = useMemo(
    () => myEntries.filter((e) => e.isSupport).reduce((sum, e) => sum + e.hours, 0),
    [myEntries]
  )

  const utilizationPct = useMemo(() => {
    if (!myCollaborator) return 0
    return calculateUtilization(totalHoursThisMonth, myCollaborator.monthlyCapacityH)
  }, [totalHoursThisMonth, myCollaborator])

  // Group entries by project
  const entriesByProject = useMemo(() => {
    const map = new Map<
      string,
      {
        project: { id: string; name: string; type: string; status: string }
        hours: number
        entries: ProjectEntry[]
      }
    >()
    myEntries.forEach((entry) => {
      const existing = map.get(entry.project.id) || {
        project: entry.project,
        hours: 0,
        entries: [],
      }
      existing.hours += entry.hours
      existing.entries.push(entry)
      map.set(entry.project.id, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
  }, [myEntries])

  const assignedProjectsCount = entriesByProject.length + myAllocations.filter(
    (a) => !entriesByProject.some((e) => e.project.id === a.project.id)
  ).length

  // Recent entries (last 10)
  const recentEntries = useMemo(
    () => [...myEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
    [myEntries]
  )

  function openEntryDialog(projectId?: string) {
    setEntryForm({
      date: format(now, 'yyyy-MM-dd'),
      hours: 8,
      note: '',
      isSupport: false,
      projectId: projectId || '',
    })
    setShowEntryDialog(true)
  }

  function handleCreateEntry() {
    if (!user?.collaboratorId) {
      toast.error('Utilizador sem perfil de colaborador')
      return
    }
    if (!entryForm.projectId) {
      toast.error('Selecione um projeto')
      return
    }
    if (entryForm.hours <= 0) {
      toast.error('Horas devem ser positivas')
      return
    }
    createEntryMutation.mutate({
      date: entryForm.date,
      projectId: entryForm.projectId,
      collaboratorId: user.collaboratorId,
      hours: entryForm.hours,
      isSupport: entryForm.isSupport,
      statusSnapshot: 'IN_PROGRESS',
      note: entryForm.note || null,
    })
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Trabalho</h1>
          <p className="ops-label mt-1">
            Vista pessoal de tarefas e horas — {format(now, 'MMMM yyyy')}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="ops-label font-normal">Horas Lançadas Este Mês</CardTitle>
              <Clock className="h-4 w-4 text-ops-accent" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="ops-mono text-3xl font-bold text-foreground">
                  {totalHoursThisMonth.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">horas</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">
                  Suporte: {supportHoursThisMonth.toFixed(1)}h
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="ops-label font-normal">% Capacidade Utilizada</CardTitle>
              <TrendingUp className="h-4 w-4 text-ops-accent" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="ops-mono text-3xl font-bold text-foreground">
                  {utilizationPct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-2">
                <UtilizationBar pct={utilizationPct} size="md" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="ops-label font-normal">Projetos Atribuídos</CardTitle>
              <Briefcase className="h-4 w-4 text-ops-accent" />
            </CardHeader>
            <CardContent>
              <span className="ops-mono text-3xl font-bold text-foreground">
                {assignedProjectsCount}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Activity List */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="ops-label">Atividades por Projeto</span>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-8"
              onClick={() => openEntryDialog()}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Registar Tempo
            </Button>
          </div>

          {entriesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : entriesByProject.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma atividade registada este mês</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entriesByProject.map(({ project, hours, entries: projEntries }) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {project.name}
                      </span>
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="ops-mono">{hours.toFixed(1)}h este mês</span>
                      <span>•</span>
                      <span>{projEntries.length} lançamentos</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-border"
                    onClick={() => openEntryDialog(project.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Registar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Planned allocations without entries */}
          {myAllocations.filter(
            (a) => !entriesByProject.some((e) => e.project.id === a.project.id)
          ).length > 0 && (
            <>
              <Separator className="bg-border my-4" />
              <span className="ops-label block mb-3">Alocações Planeadas (sem lançamentos)</span>
              <div className="space-y-2">
                {myAllocations
                  .filter(
                    (a) => !entriesByProject.some((e) => e.project.id === a.project.id)
                  )
                  .map((alloc) => (
                    <div
                      key={alloc.id}
                      className="flex items-center justify-between rounded-md border border-dashed border-border bg-background/50 p-3"
                    >
                      <div className="flex-1">
                        <span className="font-medium text-foreground text-sm">
                          {alloc.project.name}
                        </span>
                        <span className="ops-mono text-xs text-muted-foreground block">
                          {alloc.plannedHours}h planeadas
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-border"
                        onClick={() => openEntryDialog(alloc.project.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Registar
                      </Button>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>

        {/* Recent Time Entries */}
        <div className="rounded-lg border border-border bg-card p-6">
          <span className="ops-label block mb-4">Lançamentos Recentes</span>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sem lançamentos recentes
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Data</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEntries.map((entry) => (
                    <TableRow key={entry.id} className="border-border">
                      <TableCell className="ops-mono text-sm">
                        {format(parseISO(entry.date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">
                          {entry.project.name}
                        </span>
                        {entry.macro && (
                          <span className="text-xs text-muted-foreground block">
                            {entry.macro.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="ops-mono text-sm text-foreground">
                          {entry.hours}h
                        </span>
                      </TableCell>
                      <TableCell>
                        {entry.isSupport ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30"
                          >
                            Suporte
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                          >
                            Projeto
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Register Time Dialog */}
      <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Registar Tempo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Project Select */}
            <div className="grid gap-2">
              <Label className="text-foreground">Projeto *</Label>
              <Select
                value={entryForm.projectId}
                onValueChange={(v) =>
                  setEntryForm({ ...entryForm, projectId: v })
                }
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Selecionar projeto..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="grid gap-2">
              <Label className="text-foreground">Data *</Label>
              <Input
                type="date"
                value={entryForm.date}
                onChange={(e) =>
                  setEntryForm({ ...entryForm, date: e.target.value })
                }
                className="bg-background border-border"
              />
            </div>

            {/* Hours */}
            <div className="grid gap-2">
              <Label className="text-foreground">Horas *</Label>
              <Input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                value={entryForm.hours}
                onChange={(e) =>
                  setEntryForm({
                    ...entryForm,
                    hours: parseFloat(e.target.value) || 0,
                  })
                }
                className="bg-background border-border ops-mono"
              />
            </div>

            {/* isSupport */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isSupport"
                checked={entryForm.isSupport}
                onCheckedChange={(checked) =>
                  setEntryForm({
                    ...entryForm,
                    isSupport: checked === true,
                  })
                }
              />
              <Label htmlFor="isSupport" className="text-foreground text-sm">
                Hora de suporte
              </Label>
            </div>

            {/* Note */}
            <div className="grid gap-2">
              <Label className="text-foreground">Nota</Label>
              <Textarea
                value={entryForm.note}
                onChange={(e) =>
                  setEntryForm({ ...entryForm, note: e.target.value })
                }
                placeholder="Observações..."
                rows={2}
                className="bg-background border-border resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEntryDialog(false)}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateEntry}
              disabled={createEntryMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createEntryMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
