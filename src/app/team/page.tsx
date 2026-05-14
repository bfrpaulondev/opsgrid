'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AppLayout } from '@/components/app-layout'
import { api } from '@/lib/api-client'
import { calculateUtilization, calculateSupportPct } from '@/lib/business-rules'
import { UtilizationBar } from '@/components/utilization-bar'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Search,
  Users,
  Pencil,
  Trash2,
  Loader2,
  UserCheck,
  UserX,
  Link2,
} from 'lucide-react'
import { collaboratorCreateSchema, collaboratorUpdateSchema } from '@/lib/validations'

// Types
interface UserAccount {
  id: string
  email: string
  name: string
  role: string
}

interface Collaborator {
  id: string
  name: string
  jobTitle: string | null
  monthlyCapacityH: number
  supportPct: number
  active: boolean
  user: UserAccount | null
  createdAt: string
  updatedAt: string
}

interface EntryItem {
  id: string
  date: string
  hours: number
  isSupport: boolean
  collaboratorId: string
}

export default function TeamPage() {
  const queryClient = useQueryClient()
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [searchTerm, setSearchTerm] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null)

  // Deactivate dialog
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  // Link user dialog
  const [linkingCollaborator, setLinkingCollaborator] = useState<Collaborator | null>(null)
  const [linkEmail, setLinkEmail] = useState('')

  // Form state
  const [form, setForm] = useState({
    name: '',
    jobTitle: '',
    monthlyCapacityH: 160,
    supportPct: 0,
    active: true,
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Fetch collaborators
  const { data: collaborators = [], isLoading: collabsLoading } = useQuery({
    queryKey: ['collaborators', showInactive],
    queryFn: () =>
      api.get<Collaborator[]>(
        '/collaborators',
        showInactive ? {} : { active: 'true' }
      ),
  })

  // Fetch current month entries for utilization
  const { data: monthEntries = [] } = useQuery({
    queryKey: ['team-entries', monthStart],
    queryFn: () =>
      api.get<EntryItem[]>('/entries', {
        from: monthStart,
        to: monthEnd,
      }),
  })

  // Utilization map
  const utilizationMap = useMemo(() => {
    const map = new Map<string, { totalHours: number; supportHours: number; pct: number }>()
    monthEntries.forEach((entry) => {
      const existing = map.get(entry.collaboratorId) || {
        totalHours: 0,
        supportHours: 0,
        pct: 0,
      }
      existing.totalHours += entry.hours
      if (entry.isSupport) existing.supportHours += entry.hours
      map.set(entry.collaboratorId, existing)
    })
    // Calculate pct
    collaborators.forEach((c) => {
      const data = map.get(c.id)
      if (data) {
        data.pct = calculateUtilization(data.totalHours, c.monthlyCapacityH)
      }
    })
    return map
  }, [monthEntries, collaborators])

  // Filtered
  const filteredCollaborators = useMemo(() => {
    if (!searchTerm) return collaborators
    const lower = searchTerm.toLowerCase()
    return collaborators.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(lower))
    )
  }, [collaborators, searchTerm])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/collaborators', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] })
      toast.success('Colaborador criado com sucesso')
      resetForm()
      setShowCreateDialog(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/collaborators/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] })
      toast.success('Colaborador atualizado')
      resetForm()
      setEditingCollaborator(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/collaborators/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] })
      toast.success('Colaborador desativado')
      setDeactivatingId(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function resetForm() {
    setForm({
      name: '',
      jobTitle: '',
      monthlyCapacityH: 160,
      supportPct: 0,
      active: true,
    })
    setFormErrors({})
  }

  function openEditDialog(collab: Collaborator) {
    setForm({
      name: collab.name,
      jobTitle: collab.jobTitle || '',
      monthlyCapacityH: collab.monthlyCapacityH,
      supportPct: collab.supportPct,
      active: collab.active,
    })
    setFormErrors({})
    setEditingCollaborator(collab)
  }

  function handleSubmit() {
    const data = {
      name: form.name,
      jobTitle: form.jobTitle || null,
      monthlyCapacityH: form.monthlyCapacityH,
      supportPct: form.supportPct,
      active: form.active,
    }

    const schema = editingCollaborator
      ? collaboratorUpdateSchema
      : collaboratorCreateSchema
    const parsed = schema.safeParse(data)

    if (!parsed.success) {
      const errors: Record<string, string> = {}
      parsed.error.issues.forEach((issue) => {
        errors[issue.path[0] as string] = issue.message
      })
      setFormErrors(errors)
      return
    }

    if (editingCollaborator) {
      updateMutation.mutate({
        id: editingCollaborator.id,
        data: parsed.data as Record<string, unknown>,
      })
    } else {
      createMutation.mutate(parsed.data as Record<string, unknown>)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Equipa</h1>
            <p className="ops-label mt-1">Gestão de colaboradores</p>
          </div>
          <Button
            onClick={() => {
              resetForm()
              setShowCreateDialog(true)
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Colaborador
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar colaboradores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="showInactive" className="text-sm text-muted-foreground">
              Mostrar inativos
            </Label>
            <Switch
              id="showInactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
          </div>
        </div>

        {/* Collaborators Table */}
        <div className="rounded-lg border border-border bg-card">
          {collabsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 ops-label">A carregar colaboradores...</span>
            </div>
          ) : filteredCollaborators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Nenhum colaborador encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Nome</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead className="text-center">Capacidade/mês</TableHead>
                    <TableHead className="text-center">% Suporte</TableHead>
                    <TableHead className="text-center">Ativo</TableHead>
                    <TableHead>Utilização (Mês)</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollaborators.map((collab) => {
                    const utilData = utilizationMap.get(collab.id)
                    const utilPct = utilData?.pct || 0
                    const totalHours = utilData?.totalHours || 0
                    const supportHours = utilData?.supportHours || 0
                    const currentSupportPct =
                      totalHours > 0
                        ? calculateSupportPct(supportHours, totalHours)
                        : collab.supportPct

                    return (
                      <TableRow
                        key={collab.id}
                        className={`border-border ${
                          !collab.active ? 'opacity-50' : 'hover:bg-muted/30'
                        }`}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {collab.name}
                            </span>
                            {collab.user && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Link2 className="h-3 w-3" />
                                {collab.user.email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {collab.jobTitle || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="ops-mono text-sm">
                            {collab.monthlyCapacityH}h
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="ops-mono text-sm text-muted-foreground">
                            {currentSupportPct.toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {collab.active ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            >
                              Ativo
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                            >
                              Inativo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <UtilizationBar pct={utilPct} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => openEditDialog(collab)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {collab.active && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-ops-danger"
                                onClick={() => setDeactivatingId(collab.id)}
                              >
                                <UserX className="h-4 w-4" />
                              </Button>
                            )}
                            {!collab.user && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-ops-accent"
                                onClick={() => {
                                  setLinkingCollaborator(collab)
                                  setLinkEmail('')
                                }}
                                title="Associar utilizador"
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Create/Edit Collaborator Dialog */}
      <Dialog
        open={showCreateDialog || !!editingCollaborator}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingCollaborator(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingCollaborator ? 'Editar Colaborador' : 'Novo Colaborador'}
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
                placeholder="Nome do colaborador"
                className="bg-background border-border"
              />
              {formErrors.name && (
                <p className="text-xs text-ops-danger">{formErrors.name}</p>
              )}
            </div>

            {/* Job Title */}
            <div className="grid gap-2">
              <Label htmlFor="jobTitle" className="text-foreground">
                Cargo
              </Label>
              <Input
                id="jobTitle"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="Ex: Developer, Analyst..."
                className="bg-background border-border"
              />
            </div>

            {/* Capacity + Support % */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="capacity" className="text-foreground">
                  Capacidade/mês (h)
                </Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={form.monthlyCapacityH}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monthlyCapacityH: parseInt(e.target.value) || 160,
                    })
                  }
                  className="bg-background border-border ops-mono"
                />
                {formErrors.monthlyCapacityH && (
                  <p className="text-xs text-ops-danger">
                    {formErrors.monthlyCapacityH}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supportPct" className="text-foreground">
                  % Suporte
                </Label>
                <Input
                  id="supportPct"
                  type="number"
                  min={0}
                  max={100}
                  value={form.supportPct}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      supportPct: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="bg-background border-border ops-mono"
                />
                {formErrors.supportPct && (
                  <p className="text-xs text-ops-danger">
                    {formErrors.supportPct}
                  </p>
                )}
              </div>
            </div>

            {/* Active */}
            {editingCollaborator && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={form.active}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, active: checked })
                  }
                />
                <Label htmlFor="active" className="text-foreground text-sm">
                  Colaborador ativo
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setEditingCollaborator(null)
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
              {editingCollaborator ? 'Guardar' : 'Criar Colaborador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog
        open={!!deactivatingId}
        onOpenChange={(open) => {
          if (!open) setDeactivatingId(null)
        }}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Desativar Colaborador
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja desativar este colaborador? Ele não poderá
              registar horas até ser reativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-ops-danger text-white hover:bg-ops-danger/90"
              onClick={() => {
                if (deactivatingId) deactivateMutation.mutate(deactivatingId)
              }}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link User Dialog */}
      <Dialog
        open={!!linkingCollaborator}
        onOpenChange={(open) => {
          if (!open) {
            setLinkingCollaborator(null)
            setLinkEmail('')
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Associar Utilizador
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Associar uma conta de utilizador a{' '}
              <strong className="text-foreground">
                {linkingCollaborator?.name}
              </strong>
            </p>
            <div className="grid gap-2">
              <Label className="text-foreground">Email do Utilizador</Label>
              <Input
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="bg-background border-border"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O utilizador deverá existir previamente no sistema.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLinkingCollaborator(null)
                setLinkEmail('')
              }}
              className="border-border"
            >
              Cancelar
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                // This would require a backend endpoint to link user to collaborator
                // For now, show a toast
                toast.info(
                  'Funcionalidade de associação será implementada via API de utilizadores'
                )
                setLinkingCollaborator(null)
                setLinkEmail('')
              }}
            >
              Associar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
