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
