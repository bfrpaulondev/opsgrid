'use client'

import { Badge } from '@/components/ui/badge'

const statusVariants: Record<string, string> = {
  NOT_STARTED: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  IN_PROGRESS: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  TRIAGE: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  BLOCKED: 'bg-red-500/20 text-red-400 border-red-500/30',
  DONE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

const statusLabels: Record<string, string> = {
  NOT_STARTED: 'Não Iniciado',
  IN_PROGRESS: 'Em Curso',
  TRIAGE: 'Triagem',
  BLOCKED: 'Bloqueado',
  DONE: 'Concluído',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={statusVariants[status] || 'bg-zinc-500/20 text-zinc-400'}
    >
      {statusLabels[status] || status.replace(/_/g, ' ')}
    </Badge>
  )
}
