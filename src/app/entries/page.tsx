'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { format, parseISO } from 'date-fns'
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Pencil,
  Search,
  X,
  CalendarIcon,
  ChevronUp,
  ChevronDown,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

import { AppLayout } from '@/components/app-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { getUtilizationColor } from '@/lib/business-rules'

// --- Types ---
interface TimeEntry {
  id: string
  date: string
  projectId: string
  project: { id: string; name: string; type: string }
  macroId?: string
  macro?: { id: string; name: string }
  collaboratorId: string
  collaborator: { id: string; name: string }
  hours: number
  isSupport: boolean
  statusSnapshot: string
  progressSnapshot?: number
  note?: string
}

interface Project {
  id: string
  name: string
  type: string
  status: string
  macros?: { id: string; name: string }[]
}

interface Collaborator {
  id: string
  name: string
  active: boolean
}

// --- Status Config ---
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_STARTED: {
    label: 'Não Iniciado',
    className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  },
  IN_PROGRESS: {
    label: 'Em Curso',
    className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  },
  TRIAGE: {
    label: 'Triagem',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  BLOCKED: {
    label: 'Bloqueado',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  DONE: {
    label: 'Concluído',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || {
    label: status,
    className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  }
  return (
    <Badge variant="outline" className={`text-[0.65rem] px-1.5 py-0 ${config.className}`}>
      {config.label}
    </Badge>
  )
}

// --- Date Picker ---
function DatePickerField({
  value,
  onChange,
  placeholder,
}: {
  value?: Date
  onChange: (date: Date | undefined) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-8 w-full justify-start text-left font-normal border-border"
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
          {value ? format(value, 'dd/MM/yyyy') : placeholder || 'Selecionar'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d)
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

// --- Entry Form Data ---
interface EntryFormData {
  date: Date | undefined
  projectId: string
  collaboratorId: string
  macroId: string
  hours: string
  statusSnapshot: string
  progressSnapshot: string
  isSupport: boolean
  note: string
}

const emptyForm: EntryFormData = {
  date: new Date(),
  projectId: '',
  collaboratorId: '',
  macroId: '',
  hours: '',
  statusSnapshot: 'IN_PROGRESS',
  progressSnapshot: '',
  isSupport: false,
  note: '',
}

export default function EntriesPage() {
  const queryClient = useQueryClient()
  const { user, isLeader } = useAuthStore()

  // --- State ---
  const [sorting, setSorting] = useState<SortingState>([])
  const [filterCollaborator, setFilterCollaborator] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [filterFrom, setFilterFrom] = useState<Date | undefined>()
  const [filterTo, setFilterTo] = useState<Date | undefined>()

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null)
  const [form, setForm] = useState<EntryFormData>(emptyForm)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<string[][]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- Data Fetching ---
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {}
    if (filterFrom) params.from = format(filterFrom, 'yyyy-MM-dd')
    if (filterTo) params.to = format(filterTo, 'yyyy-MM-dd')
    if (filterCollaborator && filterCollaborator !== 'all') params.collaboratorId = filterCollaborator
    if (filterProject && filterProject !== 'all') params.projectId = filterProject
    // For collaborators, only see own entries
    if (!isLeader() && user?.collaboratorId) {
      params.collaboratorId = user.collaboratorId
    }
    return params
  }, [filterFrom, filterTo, filterCollaborator, filterProject, isLeader, user?.collaboratorId])

  const { data: entries = [], isLoading: entriesLoading } = useQuery<TimeEntry[]>({
    queryKey: ['entries', queryParams],
    queryFn: () => api.get('/entries', queryParams),
  })

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects'),
  })

  const { data: collaborators = [] } = useQuery<Collaborator[]>({
    queryKey: ['collaborators'],
    queryFn: () => api.get('/collaborators', { active: 'true' }),
  })

  // Fetch macros for selected project
  const { data: projectDetail } = useQuery<Project & { macros?: { id: string; name: string }[] }>({
    queryKey: ['project-detail', form.projectId],
    queryFn: () => api.get(`/projects/${form.projectId}`),
    enabled: !!form.projectId,
  })

  const macros = projectDetail?.macros || []

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: async (data: EntryFormData) => {
      const body: Record<string, unknown> = {
        date: data.date ? format(data.date, 'yyyy-MM-dd') : '',
        projectId: data.projectId,
        collaboratorId: data.collaboratorId,
        hours: parseFloat(data.hours),
        statusSnapshot: data.statusSnapshot,
        isSupport: data.isSupport,
      }
      if (data.macroId) body.macroId = data.macroId
      if (data.progressSnapshot) body.progressSnapshot = parseFloat(data.progressSnapshot)
      if (data.note) body.note = data.note
      return api.post<{ entry: TimeEntry; warning?: { type: string; message: string; utilizationPct: number } }>('/entries', body)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setCreateOpen(false)
      setForm(emptyForm)
      toast.success('Lançamento criado com sucesso')
      if (result.warning) {
        toast.warning(result.warning.message, { duration: 6000 })
      }
    },
    onError: () => {
      toast.error('Erro ao criar lançamento')
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EntryFormData> }) => {
      const body: Record<string, unknown> = {}
      if (data.date) body.date = format(data.date, 'yyyy-MM-dd')
      if (data.projectId) body.projectId = data.projectId
      if (data.collaboratorId) body.collaboratorId = data.collaboratorId
      if (data.hours) body.hours = parseFloat(data.hours)
      if (data.statusSnapshot) body.statusSnapshot = data.statusSnapshot
      if (data.isSupport !== undefined) body.isSupport = data.isSupport
      if (data.macroId !== undefined) body.macroId = data.macroId || null
      if (data.progressSnapshot !== undefined) body.progressSnapshot = data.progressSnapshot ? parseFloat(data.progressSnapshot) : null
      if (data.note !== undefined) body.note = data.note || null
      return api.patch(`/entries/${id}`, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setEditOpen(false)
      setSelectedEntry(null)
      setForm(emptyForm)
      toast.success('Lançamento atualizado com sucesso')
    },
    onError: () => {
      toast.error('Erro ao atualizar lançamento')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setDeleteOpen(false)
      setSelectedEntry(null)
      toast.success('Lançamento eliminado com sucesso')
    },
    onError: () => {
      toast.error('Erro ao eliminar lançamento')
    },
  })

  // --- Handlers ---
  const handleCreate = () => {
    setForm({
      ...emptyForm,
      date: new Date(),
      collaboratorId: user?.collaboratorId || '',
    })
    setCreateOpen(true)
  }

  const handleEdit = (entry: TimeEntry) => {
    setSelectedEntry(entry)
    setForm({
      date: entry.date ? parseISO(entry.date) : new Date(),
      projectId: entry.projectId,
      collaboratorId: entry.collaboratorId,
      macroId: entry.macroId || '',
      hours: String(entry.hours),
      statusSnapshot: entry.statusSnapshot,
      progressSnapshot: entry.progressSnapshot != null ? String(entry.progressSnapshot) : '',
      isSupport: entry.isSupport,
      note: entry.note || '',
    })
    setEditOpen(true)
  }

  const handleDelete = (entry: TimeEntry) => {
    setSelectedEntry(entry)
    setDeleteOpen(true)
  }

  const handleSubmitCreate = () => {
    if (!form.date || !form.projectId || !form.collaboratorId || !form.hours) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }
    createMutation.mutate(form)
  }

  const handleSubmitEdit = () => {
    if (!selectedEntry) return
    updateMutation.mutate({ id: selectedEntry.id, data: form })
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set('from', format(filterFrom, 'yyyy-MM-dd'))
      if (filterTo) params.set('to', format(filterTo, 'yyyy-MM-dd'))
      if (filterCollaborator && filterCollaborator !== 'all') params.set('collaboratorId', filterCollaborator)
      if (filterProject && filterProject !== 'all') params.set('projectId', filterProject)
      params.set('format', 'csv')

      const res = await fetch(`/api/entries/export?${params.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'lancamentos.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Ficheiro CSV exportado')
    } catch {
      toast.error('Erro ao exportar CSV')
    }
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const lines = text.split('\n').filter((l) => l.trim())
      const parsed = lines.map((l) =>
        l.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      )
      setImportPreview(parsed)
    }
    reader.readAsText(file)
  }

  const handleImportConfirm = async () => {
    if (!importFile) return
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await fetch('/api/entries/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.message || 'Erro ao importar')
        return
      }
      toast.success(
        `Importação concluída: ${result.imported} registos importados${result.errors > 0 ? `, ${result.errors} erros` : ''}`
      )
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      setImportOpen(false)
      setImportFile(null)
      setImportPreview([])
    } catch {
      toast.error('Erro ao importar CSV')
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearFilters = () => {
    setFilterCollaborator('')
    setFilterProject('')
    setFilterFrom(undefined)
    setFilterTo(undefined)
  }

  const hasActiveFilters =
    filterCollaborator || filterProject || filterFrom || filterTo

  // --- Table Columns ---
  const columns = useMemo<ColumnDef<TimeEntry>[]>(
    () => [
      {
        accessorKey: 'date',
        header: 'Data',
        size: 90,
        cell: ({ row }) => {
          const d = row.original.date
          return (
            <span className="ops-mono text-xs">
              {d ? format(parseISO(d), 'dd/MM/yy') : '—'}
            </span>
          )
        },
      },
      {
        accessorKey: 'project.name',
        header: 'Projeto',
        size: 150,
        cell: ({ row }) => (
          <span className="text-sm truncate max-w-[140px] block">
            {row.original.project?.name || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'collaborator.name',
        header: 'Colaborador',
        size: 130,
        cell: ({ row }) => (
          <span className="text-sm truncate max-w-[120px] block">
            {row.original.collaborator?.name || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'macro.name',
        header: 'Macro',
        size: 110,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[100px] block">
            {row.original.macro?.name || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'hours',
        header: 'Horas',
        size: 70,
        cell: ({ row }) => (
          <span className="ops-mono text-sm font-medium text-ops-accent">
            {row.original.hours}
          </span>
        ),
      },
      {
        accessorKey: 'statusSnapshot',
        header: 'Status',
        size: 100,
        cell: ({ row }) => <StatusBadge status={row.original.statusSnapshot} />,
      },
      {
        accessorKey: 'progressSnapshot',
        header: 'Progresso',
        size: 100,
        cell: ({ row }) => {
          const pct = row.original.progressSnapshot
          if (pct == null) return <span className="text-xs text-muted-foreground">—</span>
          return (
            <div className="flex items-center gap-2">
              <Progress value={pct} className="h-1.5 w-14" />
              <span className="ops-mono text-[0.65rem] text-muted-foreground">
                {pct}%
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'isSupport',
        header: 'Suporte?',
        size: 70,
        cell: ({ row }) =>
          row.original.isSupport ? (
            <Badge className="bg-ops-warning/20 text-ops-warning border-ops-warning/30 text-[0.6rem] px-1 py-0">
              Sim
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">Não</span>
          ),
      },
      {
        accessorKey: 'note',
        header: 'Nota',
        size: 140,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate max-w-[130px] block">
            {row.original.note || '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 80,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-ops-accent"
              onClick={() => handleEdit(row.original)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-ops-danger"
              onClick={() => handleDelete(row.original)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // --- Entry Form Dialog (shared for create/edit) ---
  const EntryFormDialog = ({
    open,
    onOpenChange,
    title,
    onSubmit,
    isEdit,
  }: {
    open: boolean
    onOpenChange: (v: boolean) => void
    title: string
    onSubmit: () => void
    isEdit: boolean
  }) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Preencha os campos abaixo para {isEdit ? 'editar' : 'criar'} o lançamento.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Date */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right ops-label">Data *</Label>
            <div className="col-span-3">
              <DatePickerField
                value={form.date}
                onChange={(d) => setForm((f) => ({ ...f, date: d }))}
                placeholder="Selecionar data"
              />
            </div>
          </div>
          {/* Project */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right ops-label">Projeto *</Label>
            <div className="col-span-3">
              <Select
                value={form.projectId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, projectId: v, macroId: '' }))
                }
              >
                <SelectTrigger className="w-full border-border">
                  <SelectValue placeholder="Selecionar projeto" />
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
          </div>
          {/* Collaborator - LEADER only */}
          {isLeader() && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right ops-label">Colaborador *</Label>
              <div className="col-span-3">
                <Select
                  value={form.collaboratorId}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, collaboratorId: v }))
                  }
                >
                  <SelectTrigger className="w-full border-border">
                    <SelectValue placeholder="Selecionar colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {collaborators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {/* Macro */}
          {form.projectId && macros.length > 0 && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right ops-label">Macro</Label>
              <div className="col-span-3">
                <Select
                  value={form.macroId}
                  onValueChange={(v) => setForm((f) => ({ ...f, macroId: v }))}
                >
                  <SelectTrigger className="w-full border-border">
                    <SelectValue placeholder="Selecionar macro (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {macros.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {/* Hours */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right ops-label">Horas *</Label>
            <div className="col-span-3">
              <Input
                type="number"
                step="0.5"
                min="0"
                value={form.hours}
                onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                className="border-border ops-mono"
                placeholder="0.0"
              />
            </div>
          </div>
          {/* Status */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right ops-label">Status</Label>
            <div className="col-span-3">
              <Select
                value={form.statusSnapshot}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, statusSnapshot: v }))
                }
              >
                <SelectTrigger className="w-full border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Progress */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right ops-label">Progresso %</Label>
            <div className="col-span-3">
              <Input
                type="number"
                min="0"
                max="100"
                value={form.progressSnapshot}
                onChange={(e) =>
                  setForm((f) => ({ ...f, progressSnapshot: e.target.value }))
                }
                className="border-border ops-mono"
                placeholder="0"
              />
            </div>
          </div>
          {/* isSupport */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right ops-label">Suporte?</Label>
            <div className="col-span-3 flex items-center gap-2">
              <Checkbox
                checked={form.isSupport}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, isSupport: v === true }))
                }
              />
              <span className="text-sm text-muted-foreground">
                Trabalho de suporte
              </span>
            </div>
          </div>
          {/* Note */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right ops-label">Nota</Label>
            <div className="col-span-3">
              <Input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="border-border"
                placeholder="Notas adicionais"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              isEdit ? 'Guardar' : 'Criar Lançamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lançamentos</h1>
            <p className="ops-label mt-1">Registo de horas e atividades</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleCreate}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Novo Lançamento
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-border"
              onClick={handleExport}
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-border"
              onClick={() => {
                setImportFile(null)
                setImportPreview([])
                setImportOpen(true)
              }}
            >
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              {isLeader() && (
                <div className="space-y-1">
                  <Label className="ops-label">Colaborador</Label>
                  <Select
                    value={filterCollaborator}
                    onValueChange={setFilterCollaborator}
                  >
                    <SelectTrigger className="w-[180px] border-border h-8">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {collaborators.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="ops-label">Projeto</Label>
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger className="w-[180px] border-border h-8">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="ops-label">De</Label>
                <DatePickerField
                  value={filterFrom}
                  onChange={setFilterFrom}
                  placeholder="Data início"
                />
              </div>
              <div className="space-y-1">
                <Label className="ops-label">Até</Label>
                <DatePickerField
                  value={filterTo}
                  onChange={setFilterTo}
                  placeholder="Data fim"
                />
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-muted-foreground hover:text-ops-danger"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {entriesLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : entries.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
                <FileSpreadsheet className="h-10 w-10" />
                <span className="text-sm">Nenhum lançamento encontrado</span>
              </div>
            ) : (
              <ScrollArea className="max-h-[calc(100vh-320px)]">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow
                        key={headerGroup.id}
                        className="border-border hover:bg-transparent"
                      >
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className="ops-label text-[0.6rem] px-3 py-2"
                            style={{ width: header.getSize() }}
                          >
                            {header.isPlaceholder ? null : (
                              <div
                                className={
                                  header.column.getCanSort()
                                    ? 'cursor-pointer select-none flex items-center gap-1'
                                    : ''
                                }
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                                {header.column.getIsSorted() === 'asc' && (
                                  <ChevronUp className="h-3 w-3" />
                                )}
                                {header.column.getIsSorted() === 'desc' && (
                                  <ChevronDown className="h-3 w-3" />
                                )}
                              </div>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row, i) => (
                      <TableRow
                        key={row.id}
                        className={`border-border ${i % 2 === 0 ? 'bg-card' : 'bg-muted/20'} hover:bg-muted/40`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="px-3 py-2">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <EntryFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          title="Novo Lançamento"
          onSubmit={handleSubmitCreate}
          isEdit={false}
        />

        {/* Edit Dialog */}
        <EntryFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          title="Editar Lançamento"
          onSubmit={handleSubmitEdit}
          isEdit={true}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Lançamento</AlertDialogTitle>
              <AlertDialogDescription>
                Tem a certeza que pretende eliminar este lançamento? Esta ação não pode ser revertida.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-ops-danger text-white hover:bg-ops-danger/90"
                onClick={() => {
                  if (selectedEntry) deleteMutation.mutate(selectedEntry.id)
                }}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import Dialog */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle>Importar CSV</DialogTitle>
              <DialogDescription>
                Carregue um ficheiro CSV com os lançamentos. Colunas obrigatórias: date, projectId, collaboratorId, hours.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleImportFile}
                  className="border-border"
                />
              </div>
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <p className="ops-label">Pré-visualização ({importPreview.length - 1} registos)</p>
                  <ScrollArea className="max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          {importPreview[0]?.map((h, i) => (
                            <TableHead key={i} className="ops-label text-[0.55rem] px-2">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.slice(1, 6).map((row, i) => (
                          <TableRow key={i} className="border-border">
                            {row.map((cell, j) => (
                              <TableCell key={j} className="px-2 py-1 text-xs">
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                        {importPreview.length > 6 && (
                          <TableRow>
                            <TableCell
                              colSpan={importPreview[0]?.length}
                              className="px-2 py-1 text-xs text-muted-foreground text-center"
                            >
                              ... e mais {importPreview.length - 6} linhas
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="border-border"
                onClick={() => setImportOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImportConfirm}
                disabled={!importFile || isSubmitting}
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  'Confirmar Importação'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  )
}
