'use client'

import { Badge } from '@/components/ui/badge'

const priorityVariants: Record<string, string> = {
  LOW: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  MEDIUM: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  HIGH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const priorityLabels: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge
      variant="outline"
      className={priorityVariants[priority] || 'bg-zinc-500/20 text-zinc-400'}
    >
      {priorityLabels[priority] || priority}
    </Badge>
  )
}
