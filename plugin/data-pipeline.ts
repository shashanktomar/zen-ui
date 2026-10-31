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
  days?: number // For rolling mode: how many days back (default 364)
  targetYear?: number // For fixed mode: which year to end on (default current year)
  weekStartDay?: 0 | 1 // 0 = Sunday, 1 = Monday (default: 1)
  levelCount?: number // Number of color intensity levels 2-10 (default: 5)
  levelThresholds?: number[] // Percentage boundaries for levels (exactly levelCount-1 values, e.g., [20,40,60,80] for 5 levels)
  valueMode?: 'clamp_zero' | 'range' // How to handle negative values (default: clamp_zero)
  missingMode?: 'zero' | 'transparent' // How to handle missing data (default: zero)
  // Diverging color scheme options
  isDiverging?: boolean // If true, calculate neutralLevel for color generation
  neutralValue?: number // The neutral point value (default: 0 if in range, else midpoint)
  maxValue?: number // Absolute ceiling for 100% intensity (when set, values >= maxValue get max level)
  colorThresholdValues?: number[] // Sorted absolute value breakpoints for colorThresholds mode
  divergingScale?: 'linear' | 'split' // Diverging level mapping (default: linear)
  scalePercentile?: number // Scale levels to this percentile instead of min/max (50-100)
}

export interface ScaleBounds {
  min: number
  max: number
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
  minCount?: number // Only set when valueMode: 'range' or diverging
  neutralLevel?: number // Only set when isDiverging: true
  scaleBounds?: ScaleBounds // Only set when scalePercentile is used
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
 * Returns exactly levelCount-1 threshold values that divide the percentage range [0, 100].
 * For levelCount=5: [20, 40, 60, 80] (4 thresholds dividing into 5 levels)
 * For levelCount=10: [10, 20, 30, 40, 50, 60, 70, 80, 90] (9 thresholds dividing into 10 levels)
 */
export function calculateEvenThresholds(levelCount: number): number[] {
  const thresholds: number[] = []
  for (let i = 1; i < levelCount; i++) {
    thresholds.push((i / levelCount) * 100)
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
    // Rolling: configurable days back from today (default 364 = 52 weeks)
    const endDate = todayMidnight
    const days = config.days ?? 364
    let startDate = addDays(endDate, -days)

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
 *
 * Uses a unified threshold model:
 * - levelCount=N produces N levels (0 to N-1)
 * - thresholds array has N-1 percentage boundaries
 * - Negative values are clamped to 0%
 * - When maxValue is provided, it overrides maxCount as the 100% ceiling
 */
export function getLevel(
  count: number,
  maxCount: number,
  levelCount: number = 5,
  thresholds?: number[],
  maxValue?: number,
): number {
  // Use maxValue if provided, otherwise use maxCount
  const effectiveMax = maxValue ?? maxCount
  if (effectiveMax === 0) return 0

  const effectiveThresholds = thresholds ?? calculateEvenThresholds(levelCount)
  // Clamp negatives to 0%, and cap at 100% (for values exceeding effectiveMax)
  const percentage = Math.min((Math.max(0, count) / effectiveMax) * 100, 100)

  for (let i = 0; i < effectiveThresholds.length; i++) {
    if (percentage <= effectiveThresholds[i]) return i
  }
  return levelCount - 1
}

/**
 * Resolves the neutral point for diverging color schemes:
 * explicit neutralValue, else 0 if in range, else midpoint. Clamped to data range.
 */
function resolveNeutralValue(
  minCount: number,
  maxCount: number,
  neutralValue?: number,
): number {
  const neutral =
    typeof neutralValue === 'number' && Number.isFinite(neutralValue)
      ? neutralValue
      : minCount <= 0 && maxCount >= 0
        ? 0
        : (minCount + maxCount) / 2
  return Math.max(minCount, Math.min(maxCount, neutral))
}

/**
 * Calculates the neutral level index for diverging color schemes.
 *
 * @param minCount - Minimum value in the data
 * @param maxCount - Maximum value in the data
 * @param levelCount - Number of color levels
 * @param neutralValue - Optional explicit neutral value (default: 0 if in range, else midpoint)
 * @returns The level index that represents the neutral point
 */
export function calculateNeutralLevel(
  minCount: number,
  maxCount: number,
  levelCount: number,
  neutralValue?: number,
): number {
  // Handle edge case: all same value
  if (minCount === maxCount) {
    return Math.floor(levelCount / 2)
  }

  const effectiveNeutral = resolveNeutralValue(minCount, maxCount, neutralValue)

  // Calculate level index
  return Math.round(
    ((effectiveNeutral - minCount) / (maxCount - minCount)) * (levelCount - 1),
  )
}

/**
 * Maps a count value to a level based on min..max range.
 * Used when valueMode is 'range'.
 *
 * Uses the same unified threshold model as getLevel:
 * - levelCount=N produces N levels (0 to N-1)
 * - thresholds array has N-1 percentage boundaries
 * - Percentage is relative to the min..max range
 * - When maxValue/minValue are provided, they override the dynamic bounds
 */
export function getLevelRange(
  count: number,
  minCount: number,
  maxCount: number,
  levelCount: number = 5,
  thresholds?: number[],
  maxValue?: number,
  minValue?: number,
): number {
  // Use provided bounds if available, otherwise use dynamic min/max
  const effectiveMin = minValue ?? minCount
  const effectiveMax = maxValue ?? maxCount

  if (effectiveMin === effectiveMax) return Math.floor(levelCount / 2)

  const effectiveThresholds = thresholds ?? calculateEvenThresholds(levelCount)
  // Clamp percentage to 0-100% range
  const rawPercentage =
    ((count - effectiveMin) / (effectiveMax - effectiveMin)) * 100
  const percentage = Math.max(0, Math.min(100, rawPercentage))

  for (let i = 0; i < effectiveThresholds.length; i++) {
    if (percentage <= effectiveThresholds[i]) return i
  }
  return levelCount - 1
}

/**
 * Returns the p-th percentile (0-100) of values, interpolating linearly
 * between the closest ranks. Returns undefined for empty input.
 */
export function percentile(values: number[], p: number): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

/**
 * Computes the min/max used for level scaling when scalePercentile is set,
 * so a few extreme days don't compress the scale for all others.
 * - linear: the (100-p)-th and p-th percentiles of all values
 * - split: each side of neutral uses the p-th percentile of its own distances
 *   from neutral (falls back to neutral when a side has no values)
 */
export function computeScaleBounds(
  values: number[],
  p: number,
  split: boolean,
  neutralValue?: number,
): ScaleBounds {
  if (values.length === 0) return { min: 0, max: 0 }

  if (!split) {
    return { min: percentile(values, 100 - p)!, max: percentile(values, p)! }
  }

  const neutral = resolveNeutralValue(
    Math.min(...values),
    Math.max(...values),
    neutralValue,
  )
  const above = values.filter((v) => v > neutral).map((v) => v - neutral)
  const below = values.filter((v) => v < neutral).map((v) => neutral - v)

  return {
    min: neutral - (percentile(below, p) ?? 0),
    max: neutral + (percentile(above, p) ?? 0),
  }
}

/**
 * Maps a count value to a level for divergingScale: 'split'.
 *
 * Only the exact neutral value gets the center level. Values above neutral are
 * scaled over the upper half of the levels (neutral..max), values below over
 * the lower half (min..neutral), so any non-neutral value gets at least the
 * first level on its side. When maxValue is provided, it caps the positive side.
 */
export function getLevelSplit(
  count: number,
  minCount: number,
  maxCount: number,
  levelCount: number,
  neutralValue?: number,
  maxValue?: number,
): number {
  const center = Math.floor(levelCount / 2)
  const sideLevels = center
  const neutral = resolveNeutralValue(minCount, maxCount, neutralValue)

  if (count === neutral || sideLevels === 0) return center

  const span =
    count > neutral ? (maxValue ?? maxCount) - neutral : neutral - minCount
  const fraction = span > 0 ? Math.abs(count - neutral) / span : 1
  const step = Math.max(
    1,
    Math.min(sideLevels, Math.ceil(fraction * sideLevels)),
  )

  return count > neutral ? center + step : center - step
}

/**
 * Maps a count value to a level based on absolute value thresholds.
 * Used when colorThresholds config is provided.
 *
 * Each threshold means "from this value onward, use this color."
 * Values below the first threshold get level 0 (first color).
 * Values above the last threshold get the last level (last color).
 *
 * @param count - The raw sensor value
 * @param thresholdValues - Sorted ascending array of threshold values
 */
export function getLevelFromColorThresholds(
  count: number,
  thresholdValues: number[],
): number {
  for (let i = thresholdValues.length - 1; i >= 0; i--) {
    if (count >= thresholdValues[i]) return i
  }
  return 0
}

/**
 * Global min/max stats for consistent color scaling across multiple ranges.
 */
export interface GlobalStats {
  minCount: number
  maxCount: number
}

/**
 * Computes global min/max across all date ranges.
 * Used for diverging mode to ensure consistent color scaling.
 */
export function computeGlobalStats(
  data: ContributionData[],
  ranges: DateRange[],
): GlobalStats {
  const dataMap = new Map<string, number>()
  for (const { date, count } of data) {
    dataMap.set(date, count)
  }

  let minCount = Infinity
  let maxCount = -Infinity

  for (const range of ranges) {
    const current = new Date(range.startDate)
    while (current <= range.endDate) {
      const dateStr = formatDate(current)
      if (dataMap.has(dateStr)) {
        const count = dataMap.get(dateStr)!
        minCount = Math.min(minCount, count)
        maxCount = Math.max(maxCount, count)
      }
      current.setDate(current.getDate() + 1)
    }
  }

  // Handle edge case: no data at all
  if (maxCount === -Infinity) {
    return { minCount: 0, maxCount: 0 }
  }

  return { minCount, maxCount }
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
  isDiverging?: boolean,
  neutralValue?: number,
  globalStats?: GlobalStats,
  maxValue?: number,
  colorThresholdValues?: number[],
  divergingScale?: 'linear' | 'split',
  scaleBounds?: ScaleBounds,
): HeatmapData {
  // Build lookup map from normalized data
  const dataMap = new Map<string, number>()
  for (const { date, count } of data) {
    dataMap.set(date, count)
  }

  // For range mode or diverging, force missingMode to transparent (zero has meaning)
  const needsRangeTracking = valueMode === 'range' || isDiverging
  const effectiveMissingMode = needsRangeTracking ? 'transparent' : missingMode
  const trackMissing = effectiveMissingMode === 'transparent'

  // First pass: collect days and find min/max counts (or use global stats)
  const days: { date: string; count: number; hasData: boolean }[] = []
  let maxCount = globalStats?.maxCount ?? (needsRangeTracking ? -Infinity : 0)
  let minCount = globalStats?.minCount ?? (needsRangeTracking ? Infinity : 0)
  const useGlobalStats = !!globalStats

  const current = new Date(range.startDate)
  while (current <= range.endDate) {
    const dateStr = formatDate(current)
    const hasData = dataMap.has(dateStr)
    const count = dataMap.get(dateStr) ?? 0 // Underflow: missing = 0

    // Only compute local min/max if not using global stats
    if (!useGlobalStats) {
      if (needsRangeTracking) {
        if (hasData) {
          maxCount = Math.max(maxCount, count)
          minCount = Math.min(minCount, count)
        }
      } else {
        maxCount = Math.max(maxCount, count)
      }
    }

    days.push({ date: dateStr, count, hasData })
    current.setDate(current.getDate() + 1)
  }

  // Handle edge case: no data at all (only when not using global stats)
  if (!useGlobalStats && needsRangeTracking && maxCount === -Infinity) {
    maxCount = 0
    minCount = 0
  }

  // Second pass: compute levels and build weeks
  const weeks: BoundedDay[][] = []
  let currentWeek: BoundedDay[] = []

  const useSplitScale = isDiverging && divergingScale === 'split'

  // Percentile bounds (when set) replace the data min/max for level scaling
  const levelMin = scaleBounds?.min ?? minCount
  const levelMax = scaleBounds?.max ?? maxCount

  for (const { date, count, hasData } of days) {
    let level: number
    if (colorThresholdValues) {
      // Absolute value thresholds — bypass percentage-based mapping
      level = getLevelFromColorThresholds(count, colorThresholdValues)
    } else if (useSplitScale) {
      // Split diverging scale: each side scaled independently from neutral
      level = hasData
        ? getLevelSplit(
            count,
            levelMin,
            levelMax,
            levelCount,
            neutralValue,
            maxValue,
          )
        : Math.floor(levelCount / 2)
    } else if (valueMode === 'range') {
      // For range mode, missing days don't get a meaningful level
      level = hasData
        ? getLevelRange(
            count,
            levelMin,
            levelMax,
            levelCount,
            thresholds,
            maxValue,
          )
        : 0
    } else {
      level = getLevel(count, levelMax, levelCount, thresholds, maxValue)
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

  // For diverging mode, always track minCount and calculate neutralLevel
  if (isDiverging || valueMode === 'range') {
    result.minCount = minCount
  }

  if (isDiverging) {
    // Calculate neutralLevel for diverging color scheme
    result.neutralLevel = useSplitScale
      ? Math.floor(levelCount / 2)
      : calculateNeutralLevel(levelMin, levelMax, levelCount, neutralValue)
  }

  if (scaleBounds) {
    result.scaleBounds = scaleBounds
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
  const isDiverging = config.isDiverging
  const neutralValue = config.neutralValue
  const maxValue = config.maxValue
  const colorThresholdValues = config.colorThresholdValues

  // Force range mode for diverging (diverging requires min/max range semantics)
  const valueMode = isDiverging ? 'range' : config.valueMode

  // For diverging mode, compute global stats across all ranges for consistency
  const globalStats = isDiverging
    ? computeGlobalStats(normalizedData, ranges)
    : undefined

  // Percentile scaling: computed over all displayed days for consistent colors
  let scaleBounds: ScaleBounds | undefined
  if (config.scalePercentile !== undefined && !colorThresholdValues) {
    const inRange = ranges.map((r) => [
      formatDate(r.startDate),
      formatDate(r.endDate),
    ])
    const values = normalizedData
      .filter(({ date }) =>
        inRange.some(([start, end]) => date >= start && date <= end),
      )
      .map(({ count }) => count)
    scaleBounds = computeScaleBounds(
      values,
      config.scalePercentile,
      !!isDiverging && config.divergingScale === 'split',
      neutralValue,
    )
  }

  return ranges.map((range) =>
    boundDataToRange(
      normalizedData,
      range,
      levelCount,
      thresholds,
      missingMode,
      valueMode,
      isDiverging,
      neutralValue,
      globalStats,
      maxValue,
      colorThresholdValues,
      config.divergingScale,
      scaleBounds,
    ),
  )
}
