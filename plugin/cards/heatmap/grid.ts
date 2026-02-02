/**
 * Grid Position Calculation for Heatmap
 *
 * Pure functions for calculating day positions in the calendar grid.
 * Extracted for testability.
 */

import type { BoundedDay } from '../../data-pipeline'
import { parseYmdDate } from '../../shared/date'

export interface GridPosition {
  day: BoundedDay
  row: number // 0-6, representing day of week position
  col: number // Calendar week index
}

/**
 * Calculates grid positions for all days in a heatmap.
 *
 * Each day is positioned based on its actual date:
 * - row: determined by day of week (0-6), adjusted for weekStartDay
 * - col: determined by which calendar week the day belongs to
 *
 * This ensures proper alignment even when the first day of the range
 * doesn't fall on the week start day (e.g., Jan 1 on a Wednesday).
 */
export function calculateGridPositions(
  days: BoundedDay[],
  weekStartDay: number, // 0 = Sunday, 1 = Monday
): GridPosition[] {
  if (days.length === 0) return []

  const firstDate = parseYmdDate(days[0].date) ?? new Date(days[0].date)
  const firstDayOfWeek = firstDate.getDay()
  const firstDayOffset = (firstDayOfWeek - weekStartDay + 7) % 7

  return days.map((day, i) => {
    const dayDate = parseYmdDate(day.date) ?? new Date(day.date)
    const dayOfWeek = dayDate.getDay()
    const row = (dayOfWeek - weekStartDay + 7) % 7
    const col = Math.floor((i + firstDayOffset) / 7)

    return { day, row, col }
  })
}

/**
 * Returns the expected row for a given day of week string.
 * Useful for test assertions.
 */
export function dayNameToRow(
  dayName: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat',
  weekStartDay: number,
): number {
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const dayOfWeek = dayMap[dayName]
  return (dayOfWeek - weekStartDay + 7) % 7
}
