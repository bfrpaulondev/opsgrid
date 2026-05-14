'use client'

import { getUtilizationColor } from '@/lib/business-rules'

export function UtilizationBar({
  pct,
  showLabel = true,
  size = 'sm',
}: {
  pct: number
  showLabel?: boolean
  size?: 'sm' | 'md'
}) {
  const colorName = getUtilizationColor(pct)
  const colorMap = {
    green: 'bg-ops-success',
    yellow: 'bg-ops-warning',
    red: 'bg-ops-danger',
  }
  const color = colorMap[colorName]
  const width = size === 'md' ? 'w-28' : 'w-20'
  const height = size === 'md' ? 'h-2.5' : 'h-2'

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${height} ${width} rounded-full bg-secondary overflow-hidden`}
      >
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className="ops-mono text-xs text-muted-foreground">
          {pct.toFixed(1)}%
        </span>
      )}
    </div>
  )
}
