export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function formatDateThai(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatMonthThai(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value)
  return !Number.isNaN(d.getTime())
}

/** Returns the [startIso, endIso] inclusive range for the month containing `dateIso`,
 * honoring the household's custom month-start day (FR-008 / Open Question 5). */
export function getMonthRange(dateIso: string, monthStartDay: number): [string, string] {
  const d = new Date(dateIso + 'T00:00:00')
  const day = d.getDate()
  const anchor = new Date(d.getFullYear(), d.getMonth(), 1)
  if (day < monthStartDay) {
    anchor.setMonth(anchor.getMonth() - 1)
  }
  anchor.setDate(Math.min(monthStartDay, daysInMonth(anchor.getFullYear(), anchor.getMonth())))
  const start = new Date(anchor)
  const end = new Date(anchor)
  end.setMonth(end.getMonth() + 1)
  end.setDate(end.getDate() - 1)
  return [toIso(start), toIso(end)]
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toIso(d)
}

/**
 * Returns the [startIso, endIso] inclusive range (Monday–Sunday) for the calendar week
 * containing `dateIso`. Used for the weekly text-summary feature — independent of the
 * household's month-start-day setting, which only affects the monthly Dashboard/Settlement view.
 */
export function getWeekRange(dateIso: string): [string, string] {
  const d = new Date(dateIso + 'T00:00:00')
  const isoDayOfWeek = (d.getDay() + 6) % 7 // Monday = 0 ... Sunday = 6
  const start = new Date(d)
  start.setDate(start.getDate() - isoDayOfWeek)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return [toIso(start), toIso(end)]
}

export function formatDateRangeThai(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString('th-TH', { day: 'numeric', month: sameMonth ? undefined : 'short' })
  const endLabel = end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} - ${endLabel}`
}
