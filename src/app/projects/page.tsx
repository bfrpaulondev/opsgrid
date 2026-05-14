'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/app-layout'
import { api } from '@/lib/api-client'
import { calculateFTE, isLate } from '@/lib/business-rules'
import { StatusBadge } from '@/components/status-badge'
import { PriorityBadge } from '@/components/priority-badge'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  CalendarIcon,
  FolderKanban,
  Clock,
  Users,
  AlertTriangle,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import { projectCreateSchema, projectUpdateSchema } from '@/lib/validations'

// Types
interface MacroActivity {
  id: string
  name: string
  status: string
  progressPct: number
  plannedDelivery: string | null
}

interface ProjectEntry {
  id: string
  date: string
  hours: number
  isSupport: boolean
  note: string | null
  collaborator: { id: string; name: string }
  macro: { id: string; name: string } | null
}

interface ProjectAllocation {
  id: string
  month: string
  plannedHours: number
  collaborator: { id: string; name: string; monthlyCapacityH: number }
}

interface Project {
  id: string
  name: string
  client: string | null
  type: string
  priority: string
  status: string
  startDate: string | null
  plannedDelivery: string | null
  actualDelivery: string | null
  riskNotes: string | null
  createdAt: string
  updatedAt: string
  macros: MacroActivity[]
  _count: { entries: number; allocations: number }
}

interface ProjectDetail extends Project {
  entries: ProjectEntry[]
  allocations: ProjectAllocation[]
  aggregated: {
    totalHours: number
    totalFTE: number
    totalPlannedHours: number
    progress: number
    utilization: number
  }
}

const projectTypes = [
  { value: 'PROJECT', label: 'Projeto' },
  { value: 'MACRO', label: 'Macro' },
  { value: 'INCIDENT', label: 'Incidente' },
  { value: 'REQUEST', label: 'Pedido' },
]

const typeLabels: Record<string, string> = {
  PROJECT: 'Projeto',
  MACRO: 'Macro',
  INCIDENT: 'Incidente',
  REQUEST: 'Pedido',
}

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // Sheet state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '',
    client: '',
    type: 'PROJECT' as string,
    priority: 'MEDIUM' as string,
    status: 'NOT_STARTED' as string,
    startDate: '' as string,
    plannedDelivery: '' as string,
    riskNotes: '',
  })
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [plannedDeliveryOpen, setPlannedDeliveryOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Macro form state
  const [macroForm, setMacroForm] = useState({ name: '', status: 'NOT_STARTED' as string })
  const [showMacroDialog, setShowMacroDialog] = useState(false)

  // Fetch projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', filterType, filterStatus],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (filterType !== 'all') params.type = filterType
      if (filterStatus !== 'all') params.status = filterStatus
      return api.get<Project[]>('/projects', params)
    },
  })

  // Fetch project detail for sheet
  const { data: projectDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['project-detail', selectedProjectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${selectedProjectId}`),
    enabled: !!selectedProjectId,
  })

  // Fetch entries for selected project
  const { data: projectEntries = [] } = useQuery({
    queryKey: ['project-entries', selectedProjectId],
    queryFn: () =>
      api.get<ProjectEntry[]>('/entries', { projectId: selectedProjectId! }),
    enabled: !!selectedProjectId,
  })

  // Fetch allocations for selected project
  const { data: projectAllocations = [] } = useQuery({
    queryKey: ['project-allocations', selectedProjectId],
    queryFn: () => api.get<ProjectAllocation[]>('/allocations'),
    select: (data: ProjectAllocation[]) =>
      data.filter((a) => a.project?.id === selectedProjectId),
    enabled: !!selectedProjectId,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Projeto criado com sucesso')
      resetForm()
      setShowCreateDialog(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project-detail', selectedProjectId] })
      toast.success('Projeto atualizado')
      resetForm()
      setEditingProject(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Projeto eliminado')
      setSheetOpen(false)
      setSelectedProjectId(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const createMacroMutation = useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: Record<string, unknown> }) =>
      api.post(`/projects/${projectId}/macros`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', selectedProjectId] })
      toast.success('Macro atividade criada')
      setMacroForm({ name: '', status: 'NOT_STARTED' })
      setShowMacroDialog(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let result = projects
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          (p.client && p.client.toLowerCase().includes(lower))
      )
    }
    return result
  }, [projects, searchTerm])

  // FTE calculation for current month
  function getProjectFTE(project: Project): number {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    // We don't have individual entries in the list, so use _count.entries as rough estimate
    // For accurate FTE, we'd need to fetch entries per project - using aggregated from detail
    return 0
  }

  function resetForm() {
    setForm({
      name: '',
      client: '',
      type: 'PROJECT',
      priority: 'MEDIUM',
      status: 'NOT_STARTED',
      startDate: '',
      plannedDelivery: '',
      riskNotes: '',
    })
    setFormErrors({})
  }

  function openEditDialog(project: Project) {
    setForm({
      name: project.name,
      client: project.client || '',
      type: project.type,
      priority: project.priority,
      status: project.status,
      startDate: project.startDate ? format(parseISO(project.startDate), 'yyyy-MM-dd') : '',
      plannedDelivery: project.plannedDelivery ? format(parseISO(project.plannedDelivery), 'yyyy-MM-dd') : '',
      riskNotes: project.riskNotes || '',
    })
    setFormErrors({})
    setEditingProject(project)
  }

  function handleSubmit() {
    const data = {
      name: form.name,
      client: form.client || null,
      type: form.type,
      priority: form.priority,
      status: form.status,
      startDate: form.startDate || null,
      plannedDelivery: form.plannedDelivery || null,
      riskNotes: form.riskNotes || null,
    }

    const schema = editingProject ? projectUpdateSchema : projectCreateSchema
    const parsed = schema.safeParse(data)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((issue) => {
        errors[issue.path[0] as string] = issue.message
      })
      setFormErrors(errors)
      return
    }

    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data: parsed.data as Record<string, unknown> })
    } else {
      createMutation.mutate(parsed.data as Record<string, unknown>)
    }
  }

  function openProjectSheet(projectId: string) {
    setSelectedProjectId(projectId)
    setSheetOpen(true)
  }

  // Progress color
  function getProgressColor(pct: number): string {
    if (pct >= 80) return 'bg-ops-success'
    if (pct >= 40) return 'bg-ops-warning'
    return 'bg-ops-accent'
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
            <p className="ops-label mt-1">Gestão de projetos e macro-atividades</p>
          </div>
          <Button
            onClick={() => {
              resetForm()
              setShowCreateDialog(true)
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Projeto
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar projetos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {projectTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px] bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="NOT_STARTED">Não Iniciado</SelectItem>
              <SelectItem value="IN_PROGRESS">Em Curso</SelectItem>
              <SelectItem value="TRIAGE">Triagem</SelectItem>
              <SelectItem value="BLOCKED">Bloqueado</SelectItem>
              <SelectItem value="DONE">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Projects Table */}
        <div className="rounded-lg border border-border bg-card">
          {projectsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 ops-label">A carregar projetos...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FolderKanban className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Nenhum projeto encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="min-w-[200px]">Projeto/Macro</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="min-w-[120px]">Progresso</TableHead>
                    <TableHead>FTE (Mês)</TableHead>
                    <TableHead>Entrega Prevista</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead className="min-w-[150px]">Notas de Risco</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => {
                    const late = isLate(project.plannedDelivery, project.status)
                    return (
                      <TableRow
                        key={project.id}
                        className={`cursor-pointer border-border transition-colors hover:bg-muted/50 ${
                          late ? 'border-l-2 border-l-ops-danger bg-ops-danger/5' : ''
                        }`}
                        onClick={() => openProjectSheet(project.id)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {project.name}
                            </span>
                            {project.client && (
                              <span className="text-xs text-muted-foreground">
                                {project.client}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {typeLabels[project.type] || project.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={project.macros?.length > 0
                                ? Math.round(
                                    project.macros.reduce(
                                      (sum, m) => sum + m.progressPct,
                                      0
                                    ) / project.macros.length
                                  )
                                : 0
                              }
                              className="h-2 w-16"
                            />
                            <span className="ops-mono text-xs text-muted-foreground">
                              {project.macros?.length > 0
                                ? `${Math.round(
                                    project.macros.reduce(
                                      (sum, m) => sum + m.progressPct,
                                      0
                                    ) / project.macros.length
                                  )}%`
                                : '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="ops-mono text-sm">
                            {project._count.entries > 0 ? '—' : '0.00'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="ops-mono text-sm">
                            {project.plannedDelivery
                              ? format(parseISO(project.plannedDelivery), 'dd/MM/yyyy')
                              : '—'}
                          </span>
                          {late && (
                            <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-ops-danger" />
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={project.status} />
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={project.priority} />
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground line-clamp-2 max-w-[150px]">
                            {project.riskNotes || '—'}
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

      {/* Create/Edit Project Dialog */}
      <Dialog
        open={showCreateDialog || !!editingProject}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingProject(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-[525px] bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-foreground">
                Nome *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome do projeto"
                className="bg-background border-border"
              />
              {formErrors.name && (
                <p className="text-xs text-ops-danger">{formErrors.name}</p>
              )}
            </div>

            {/* Client */}
            <div className="grid gap-2">
              <Label htmlFor="client" className="text-foreground">
                Cliente
              </Label>
              <Input
                id="client"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                placeholder="Nome do cliente"
                className="bg-background border-border"
              />
            </div>

            {/* Type + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-foreground">Tipo *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-foreground">Prioridade *</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baixa</SelectItem>
                    <SelectItem value="MEDIUM">Média</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="CRITICAL">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label className="text-foreground">Status *</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">Não Iniciado</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em Curso</SelectItem>
                  <SelectItem value="TRIAGE">Triagem</SelectItem>
                  <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                  <SelectItem value="DONE">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-foreground">Data de Início</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-background border-border justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.startDate
                        ? format(parseISO(form.startDate), 'dd/MM/yyyy')
                        : 'Selecionar...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        form.startDate ? parseISO(form.startDate) : undefined
                      }
                      onSelect={(date) => {
                        setForm({
                          ...form,
                          startDate: date ? format(date, 'yyyy-MM-dd') : '',
                        })
                        setStartDateOpen(false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-2">
                <Label className="text-foreground">Entrega Prevista</Label>
                <Popover
                  open={plannedDeliveryOpen}
                  onOpenChange={setPlannedDeliveryOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-background border-border justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.plannedDelivery
                        ? format(parseISO(form.plannedDelivery), 'dd/MM/yyyy')
                        : 'Selecionar...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        form.plannedDelivery
                          ? parseISO(form.plannedDelivery)
                          : undefined
                      }
                      onSelect={(date) => {
                        setForm({
                          ...form,
                          plannedDelivery: date
                            ? format(date, 'yyyy-MM-dd')
                            : '',
                        })
                        setPlannedDeliveryOpen(false)
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Risk Notes */}
            <div className="grid gap-2">
              <Label htmlFor="riskNotes" className="text-foreground">
                Notas de Risco
              </Label>
              <Textarea
                id="riskNotes"
                value={form.riskNotes}
                onChange={(e) => setForm({ ...form, riskNotes: e.target.value })}
                placeholder="Observações sobre riscos..."
                rows={3}
                className="bg-background border-border resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setEditingProject(null)
                resetForm()
              }}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingProject ? 'Guardar' : 'Criar Projeto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => {
        setSheetOpen(open)
        if (!open) setSelectedProjectId(null)
      }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[600px] bg-card border-border p-0"
        >
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : projectDetail ? (
            <>
              <SheetHeader className="p-6 pb-4 border-b border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <SheetTitle className="text-xl text-foreground">
                      {projectDetail.name}
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {projectDetail.client && (
                        <span className="text-muted-foreground">
                          {projectDetail.client} •{' '}
                        </span>
                      )}
                      <Badge variant="secondary" className="text-xs mr-2">
                        {typeLabels[projectDetail.type]}
                      </Badge>
                      <StatusBadge status={projectDetail.status} />
                      <PriorityBadge priority={projectDetail.priority} />
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSheetOpen(false)
                        openEditDialog(projectDetail)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-ops-danger"
                      onClick={() => {
                        if (confirm('Tem certeza que deseja eliminar este projeto?')) {
                          deleteMutation.mutate(projectDetail.id)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              {/* Project Info */}
              <div className="p-6 pb-3 border-b border-border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="ops-label block mb-1">Início</span>
                    <span className="ops-mono text-foreground">
                      {projectDetail.startDate
                        ? format(parseISO(projectDetail.startDate), 'dd/MM/yyyy')
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="ops-label block mb-1">Entrega Prevista</span>
                    <span className="ops-mono text-foreground">
                      {projectDetail.plannedDelivery
                        ? format(parseISO(projectDetail.plannedDelivery), 'dd/MM/yyyy')
                        : '—'}
                    </span>
                    {isLate(projectDetail.plannedDelivery, projectDetail.status) && (
                      <Badge variant="outline" className="ml-2 bg-ops-danger/20 text-ops-danger border-ops-danger/30 text-[10px]">
                        Atrasado
                      </Badge>
                    )}
                  </div>
                  <div>
                    <span className="ops-label block mb-1">Horas Totais</span>
                    <span className="ops-mono text-foreground">
                      {projectDetail.aggregated?.totalHours ?? 0}h
                    </span>
                  </div>
                  <div>
                    <span className="ops-label block mb-1">FTE</span>
                    <span className="ops-mono text-foreground">
                      {projectDetail.aggregated?.totalFTE?.toFixed(2) ?? '0.00'}
                    </span>
                  </div>
                  <div>
                    <span className="ops-label block mb-1">Horas Planeadas</span>
                    <span className="ops-mono text-foreground">
                      {projectDetail.aggregated?.totalPlannedHours ?? 0}h
                    </span>
                  </div>
                  <div>
                    <span className="ops-label block mb-1">Progresso</span>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={projectDetail.aggregated?.progress ?? 0}
                        className="h-2 w-16"
                      />
                      <span className="ops-mono text-xs text-muted-foreground">
                        {projectDetail.aggregated?.progress ?? 0}%
                      </span>
                    </div>
                  </div>
                </div>
                {projectDetail.riskNotes && (
                  <div className="mt-4 rounded-md bg-ops-danger/10 border border-ops-danger/20 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-ops-danger" />
                      <span className="ops-label text-ops-danger">Notas de Risco</span>
                    </div>
                    <p className="text-sm text-foreground">{projectDetail.riskNotes}</p>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <Tabs defaultValue="macros" className="flex-1">
                <div className="px-6 pt-3">
                  <TabsList className="bg-muted">
                    <TabsTrigger value="macros" className="text-xs">
                      <FolderKanban className="h-3.5 w-3.5 mr-1.5" />
                      Macros ({projectDetail.macros?.length ?? 0})
                    </TabsTrigger>
                    <TabsTrigger value="entries" className="text-xs">
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      Lançamentos ({projectEntries.length})
                    </TabsTrigger>
                    <TabsTrigger value="allocations" className="text-xs">
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      Alocações ({projectAllocations.length})
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="h-[calc(100vh-420px)]">
                  {/* Macros Tab */}
                  <TabsContent value="macros" className="px-6 pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="ops-label">Macro Atividades</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-border"
                        onClick={() => setShowMacroDialog(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    {projectDetail.macros?.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhuma macro atividade
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {projectDetail.macros?.map((macro) => (
                          <div
                            key={macro.id}
                            className="flex items-center justify-between rounded-md border border-border p-3 bg-background"
                          >
                            <div className="flex-1">
                              <span className="text-sm font-medium text-foreground">
                                {macro.name}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <StatusBadge status={macro.status} />
                                <Progress value={macro.progressPct} className="h-1.5 w-12" />
                                <span className="ops-mono text-xs text-muted-foreground">
                                  {macro.progressPct}%
                                </span>
                              </div>
                            </div>
                            {macro.plannedDelivery && (
                              <span className="ops-mono text-xs text-muted-foreground">
                                {format(parseISO(macro.plannedDelivery), 'dd/MM/yy')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Entries Tab */}
                  <TabsContent value="entries" className="px-6 pt-3">
                    <span className="ops-label block mb-3">Lançamentos de Tempo</span>
                    {projectEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhum lançamento
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {projectEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between rounded-md border border-border p-3 bg-background"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-foreground">
                                  {entry.collaborator.name}
                                </span>
                                {entry.isSupport && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30"
                                  >
                                    Suporte
                                  </Badge>
                                )}
                              </div>
                              {entry.note && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {entry.note}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="ops-mono text-sm text-foreground">
                                {entry.hours}h
                              </span>
                              <span className="ops-mono text-xs text-muted-foreground block">
                                {format(parseISO(entry.date), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Allocations Tab */}
                  <TabsContent value="allocations" className="px-6 pt-3">
                    <span className="ops-label block mb-3">Alocações Planeadas</span>
                    {projectAllocations.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhuma alocação
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {projectAllocations.map((alloc) => (
                          <div
                            key={alloc.id}
                            className="flex items-center justify-between rounded-md border border-border p-3 bg-background"
                          >
                            <div>
                              <span className="text-sm font-medium text-foreground">
                                {alloc.collaborator.name}
                              </span>
                              <span className="ops-mono text-xs text-muted-foreground block">
                                {alloc.month}
                              </span>
                            </div>
                            <span className="ops-mono text-sm text-foreground">
                              {alloc.plannedHours}h
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-sm">Selecione um projeto</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Macro Dialog */}
      <Dialog open={showMacroDialog} onOpenChange={setShowMacroDialog}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova Macro Atividade</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="macroName" className="text-foreground">
                Nome *
              </Label>
              <Input
                id="macroName"
                value={macroForm.name}
                onChange={(e) =>
                  setMacroForm({ ...macroForm, name: e.target.value })
                }
                placeholder="Nome da macro atividade"
                className="bg-background border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-foreground">Status</Label>
              <Select
                value={macroForm.status}
                onValueChange={(v) => setMacroForm({ ...macroForm, status: v })}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">Não Iniciado</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em Curso</SelectItem>
                  <SelectItem value="TRIAGE">Triagem</SelectItem>
                  <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                  <SelectItem value="DONE">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMacroDialog(false)}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!macroForm.name) {
                  toast.error('Nome é obrigatório')
                  return
                }
                if (selectedProjectId) {
                  createMacroMutation.mutate({
                    projectId: selectedProjectId,
                    data: {
                      name: macroForm.name,
                      status: macroForm.status,
                      progressPct: 0,
                    },
                  })
                }
              }}
              disabled={createMacroMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createMacroMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
