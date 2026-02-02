/**
 * Shared date helpers to keep calendar logic in local time.
 */

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isYmdDate(value: string): boolean {
  return YMD_REGEX.test(value)
}

export function parseYmdDate(value: string): Date | null {
  if (!isYmdDate(value)) return null

  const [yearStr, monthStr, dayStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null
  }

  return new Date(year, month - 1, day)
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toLocalDateString(value: string | number): string | null {
  if (typeof value === 'string' && isYmdDate(value)) {
    return value
  }

  if (typeof value === 'string' && !value.includes('T')) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return formatLocalDate(date)
}
