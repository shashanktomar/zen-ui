/**
 * Data Pipeline for zen-ui
 *
 * Pure functions with no dependencies on Lit or Home Assistant.
 * Handles date/data logic separately from rendering.
 */

import { isYmdDate, toLocalDateString } from './shared/date'

// ============================================================================
// Types
// ============================================================================

export interface PipelineConfig {
  mode: 'rolling' | 'fixed'
  years?: number // For fixed mode: how many years (default 1)
  targetYear?: number // For fixed mode: which year to end on (default current year)
  weekStartDay?: 0 | 1 // 0 = Sunday, 1 = Monday (default: 1)
  levelCount?: number // Number of color intensity levels 2-10 (default: 5)
  levelThresholds?: number[] // Percentages for level boundaries (must have levelCount-1 values if provided)
  valueMode?: 'clamp_zero' | 'range' // How to handle negative values (default: clamp_zero)
  missingMode?: 'zero' | 'transparent' // How to handle missing data (default: zero)
}

export interface ContributionData {
  date: string // YYYY-MM-DD
  count: number
}

export interface DateRange {
  startDate: Date // First day (weekStartDay of first week)
  endDate: Date // Last day (day before next weekStartDay)
  label?: string // e.g., "2024" for fixed mode
}

export interface BoundedDay {
  date: string // YYYY-MM-DD
  count: number // 0 if no data
  level: number // Color intensity level (0 to levelCount-1)
  missing?: boolean // True if no data was provided for this date (only set when missingMode: 'transparent')
}

export interface HeatmapData {
  range: DateRange
  weeks: BoundedDay[][] // 52-53 weeks x 7 days
  maxCount: number
  minCount?: number // Only set when valueMode: 'range'
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats a Date as YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns a new Date set to midnight local time
 */
function toMidnight(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Adds days to a date, returning a new Date
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Gets the day of week (0 = Sunday, 1 = Monday, etc.)
 */
function getDayOfWeek(date: Date): number {
  return date.getDay()
}

// ============================================================================
// Core Pipeline Functions
// ============================================================================

/**
 * Calculates evenly distributed thresholds for a given level count.
 *
 * For levelCount=5: [25, 50, 75] (4 non-zero levels, 3 thresholds)
 * For levelCount=10: [11.1, 22.2, 33.3, 44.4, 55.5, 66.6, 77.7, 88.8] (9 non-zero levels, 8 thresholds)
 */
export function calculateEvenThresholds(levelCount: number): number[] {
  const nonZeroLevels = levelCount - 1
  const thresholds: number[] = []
  for (let i = 1; i < nonZeroLevels; i++) {
    thresholds.push((i / nonZeroLevels) * 100)
  }
  return thresholds
}

/**
 * Normalizes raw Home Assistant data into a consistent ContributionData[] array.
 *
 * Supports:
 * - Format A: Array of date strings (count occurrences)
 * - Format B: Array of {date, count} objects (pass-through)
 * - Format C: Datetime strings with timestamps (extracts date portion)
 */
export function normalizeData(raw: unknown): ContributionData[] {
  // Guard: must be a non-empty array
  if (!Array.isArray(raw) || raw.length === 0) {
    return []
  }

  const first = raw[0]

  // Format B: Array of {date, count} objects
  if (
    typeof first === 'object' &&
    first !== null &&
    'date' in first &&
    'count' in first
  ) {
    return raw
      .filter(
        (item): item is { date: string; count: number } =>
          typeof item === 'object' &&
          item !== null &&
          'date' in item &&
          'count' in item &&
          typeof item.date === 'string' &&
          typeof item.count === 'number' &&
          isYmdDate(item.date),
      )
      .map((item) => ({ date: item.date, count: item.count }))
  }

  // Format A/C: Array of strings (dates or datetimes)
  if (typeof first === 'string') {
    const counts: Record<string, number> = {}

    for (const item of raw) {
      if (typeof item !== 'string') continue

      const datePart = toLocalDateString(item)
      if (!datePart) continue

      counts[datePart] = (counts[datePart] || 0) + 1
    }

    return Object.entries(counts).map(([date, count]) => ({ date, count }))
  }

  // Unknown format
  return []
}

/**
 * Calculates date ranges for the heatmap based on configuration.
 *
 * - Rolling mode: Single range of 52 weeks ending today
 * - Fixed mode: One range per year
 */
export function calculateDateRanges(
  config: PipelineConfig,
  today: Date = new Date(),
): DateRange[] {
  const weekStart = config.weekStartDay ?? 1 // Default Monday
  const todayMidnight = toMidnight(today)

  if (config.mode === 'rolling') {
    // Rolling: 52 weeks (364 days) back from today
    const endDate = todayMidnight
    let startDate = addDays(endDate, -364)

    // Adjust startDate back to weekStart day on or before that date
    const startDow = getDayOfWeek(startDate)
    const daysToSubtract = (startDow - weekStart + 7) % 7
    startDate = addDays(startDate, -daysToSubtract)

    // Don't extend endDate past today - avoids showing empty future day squares
    return [{ startDate, endDate }]
  }

  // Fixed mode: one range per year (strict Jan 1 - Dec 31, no week boundary adjustment)
  const targetYear = config.targetYear ?? todayMidnight.getFullYear()
  const yearsToShow = config.years ?? 1
  const ranges: DateRange[] = []

  for (let i = 0; i < yearsToShow; i++) {
    const year = targetYear - yearsToShow + 1 + i
    const startDate = new Date(year, 0, 1) // Jan 1
    const endDate = new Date(year, 11, 31) // Dec 31
    ranges.push({ startDate, endDate, label: year.toString() })
  }

  return ranges
}

/**
 * Maps a count value to a color intensity level (0 to levelCount-1).
 */
export function getLevel(
  count: number,
  maxCount: number,
  levelCount: number = 5,
  thresholds?: number[],
): number {
  if (count <= 0) return 0 // Empty, zero, or negative (clamped to zero)
  if (maxCount === 0) return 1 // Edge case: all zeros except this

  // Auto-calculate thresholds if not provided
  const effectiveThresholds = thresholds ?? calculateEvenThresholds(levelCount)

  const percentage = (count / maxCount) * 100

  for (let i = 0; i < effectiveThresholds.length; i++) {
    if (percentage <= effectiveThresholds[i]) return i + 1
  }
  return levelCount - 1 // Highest level
}

/**
 * Maps a count value to a level based on min..max range.
 * Used when valueMode is 'range'.
 */
export function getLevelRange(
  count: number,
  minCount: number,
  maxCount: number,
  levelCount: number = 5,
  thresholds?: number[],
): number {
  // Handle edge case: all same value
  if (minCount === maxCount) return Math.floor(levelCount / 2)

  // Calculate percentage within the range (0-100)
  const range = maxCount - minCount
  const percentage = ((count - minCount) / range) * 100

  // Use custom thresholds if provided
  if (thresholds) {
    for (let i = 0; i < thresholds.length; i++) {
      if (percentage <= thresholds[i]) return i
    }
    return levelCount - 1
  }

  // Linear distribution: evenly spread across levels
  const level = Math.floor((percentage / 100) * levelCount)
  return Math.min(level, levelCount - 1) // Clamp to max level
}

/**
 * Bounds data to a date range, producing a complete grid.
 *
 * - Filters out data outside the range (trims overflow)
 * - Fills missing dates with count: 0 (handles underflow)
 * - Returns a complete week grid
 */
export function boundDataToRange(
  data: ContributionData[],
  range: DateRange,
  levelCount: number = 5,
  thresholds?: number[],
  missingMode?: 'zero' | 'transparent',
  valueMode?: 'clamp_zero' | 'range',
): HeatmapData {
  // Build lookup map from normalized data
  const dataMap = new Map<string, number>()
  for (const { date, count } of data) {
    dataMap.set(date, count)
  }

  // For range mode, force missingMode to transparent (zero has meaning)
  const effectiveMissingMode =
    valueMode === 'range' ? 'transparent' : missingMode
  const trackMissing = effectiveMissingMode === 'transparent'

  // First pass: collect days and find min/max counts
  const days: { date: string; count: number; hasData: boolean }[] = []
  let maxCount = valueMode === 'range' ? -Infinity : 0
  let minCount = valueMode === 'range' ? Infinity : 0

  const current = new Date(range.startDate)
  while (current <= range.endDate) {
    const dateStr = formatDate(current)
    const hasData = dataMap.has(dateStr)
    const count = dataMap.get(dateStr) ?? 0 // Underflow: missing = 0

    // Only consider days with data for min/max in range mode
    if (valueMode === 'range') {
      if (hasData) {
        maxCount = Math.max(maxCount, count)
        minCount = Math.min(minCount, count)
      }
    } else {
      maxCount = Math.max(maxCount, count)
    }

    days.push({ date: dateStr, count, hasData })
    current.setDate(current.getDate() + 1)
  }

  // Handle edge case: no data at all
  if (valueMode === 'range' && maxCount === -Infinity) {
    maxCount = 0
    minCount = 0
  }

  // Second pass: compute levels and build weeks
  const weeks: BoundedDay[][] = []
  let currentWeek: BoundedDay[] = []

  for (const { date, count, hasData } of days) {
    let level: number
    if (valueMode === 'range') {
      // For range mode, missing days don't get a meaningful level
      level = hasData
        ? getLevelRange(count, minCount, maxCount, levelCount, thresholds)
        : 0
    } else {
      level = getLevel(count, maxCount, levelCount, thresholds)
    }

    const day: BoundedDay = { date, count, level }

    if (trackMissing) {
      day.missing = !hasData
    }

    currentWeek.push(day)

    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // Handle partial final week (if any)
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  const result: HeatmapData = { range, weeks, maxCount }
  if (valueMode === 'range') {
    result.minCount = minCount
  }

  return result
}

/**
 * Main pipeline function: processes raw data into ready-to-render heatmap data.
 *
 * Returns an array of HeatmapData:
 * - Rolling mode: single item
 * - Fixed mode: one item per year
 */
export function processHeatmapData(
  config: PipelineConfig,
  rawData: unknown,
  today: Date = new Date(),
): HeatmapData[] {
  const normalizedData = normalizeData(rawData)
  const ranges = calculateDateRanges(config, today)

  // Validate and clamp levelCount to 2-10 (default: 5)
  const rawLevelCount = config.levelCount ?? 5
  const levelCount = Math.max(2, Math.min(10, rawLevelCount))

  const thresholds = config.levelThresholds
  const missingMode = config.missingMode
  const valueMode = config.valueMode

  return ranges.map((range) =>
    boundDataToRange(
      normalizedData,
      range,
      levelCount,
      thresholds,
      missingMode,
      valueMode,
    ),
  )
}
