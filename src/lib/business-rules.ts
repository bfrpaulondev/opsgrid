/**
 * Business rules for OpsGrid calculations
 */

export function calculateFTE(hours: number, capacity: number = 160): number {
  return Math.round((hours / capacity) * 100) / 100
}

export function calculateUtilization(
  loggedHours: number,
  capacity: number
): number {
  if (capacity === 0) return 0
  return Math.round((loggedHours / capacity) * 10000) / 100
}

export function calculateSupportPct(
  supportHours: number,
  totalHours: number
): number {
  if (totalHours === 0) return 0
  return Math.round((supportHours / totalHours) * 10000) / 100
}

/**
 * RN-04: Utilization color thresholds
 * - Green: <= 80%
 * - Yellow: > 80% and <= 100%
 * - Red: > 100%
 */
export function getUtilizationColor(pct: number): string {
  if (pct <= 80) return 'green'
  if (pct <= 100) return 'yellow'
  return 'red'
}

export function calculateProgress(
  hoursSpent: number,
  hoursPlanned: number
): number {
  if (hoursPlanned === 0) return 0
  return Math.min(Math.round((hoursSpent / hoursPlanned) * 100), 100)
}

export function isLate(
  plannedDelivery: Date | string | null,
  status: string
): boolean {
  if (!plannedDelivery) return false
  if (status === 'DONE') return false
  const delivery = new Date(plannedDelivery)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  delivery.setHours(0, 0, 0, 0)
  return delivery < today
}

export function getWorkingDaysInMonth(year: number, month: number): number {
  let count = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
  }
  return count
}
