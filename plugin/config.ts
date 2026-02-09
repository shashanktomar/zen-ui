/**
 * Configuration schema and validation for zen-ui
 *
 * Lenient validation using valibot:
 * - Only throws for required fields
 * - Falls back to defaults for invalid optional values
 */

import * as v from 'valibot'
import { HEX_COLOR_REGEX } from './color-utils'

// Week start day type
export type WeekStartDay = 'sunday' | 'monday'

// Weekday labels mode type
export type WeekdayLabelsMode = 'none' | 'short' | 'all' | 'letter'

// Card type - extend as new types are added
export type CardType = 'heatmap'

// Missing mode type
export type MissingMode = 'zero' | 'transparent'

// Value mode type
export type ValueMode = 'clamp_zero' | 'range'

// Default values
export const CONFIG_DEFAULTS = {
  range: 'rolling' as const,
  years: 1,
  weekStartDay: 'monday' as WeekStartDay,
  weekdayLabels: 'short' as WeekdayLabelsMode,
  levelCount: 5,
  baseColor: '#40c463',
  show_legend: true,
  attribute: 'data',
  missingMode: 'zero' as MissingMode,
  valueMode: 'clamp_zero' as ValueMode,
} as const

// Convert weekStartDay to pipeline format (0 = Sunday, 1 = Monday)
export function weekStartDayToNumber(day: WeekStartDay): 0 | 1 {
  return day === 'sunday' ? 0 : 1
}

// Helper: transform with fallback (returns default if validation fails)
function withFallback<T>(schema: v.GenericSchema<unknown, T>, fallback: T) {
  return v.pipe(
    v.unknown(),
    v.transform((input) => {
      const result = v.safeParse(schema, input)
      return result.success ? result.output : fallback
    }),
  )
}

// Schema for weekStartDay: accepts string (case-insensitive) or legacy numbers
const WeekStartDaySchema = v.pipe(
  v.unknown(),
  v.transform((input): WeekStartDay => {
    if (typeof input === 'string') {
      const lower = input.toLowerCase()
      if (lower === 'sunday' || lower === 'sun') return 'sunday'
      if (lower === 'monday' || lower === 'mon') return 'monday'
    }
    if (input === 0) return 'sunday'
    if (input === 1) return 'monday'
    return CONFIG_DEFAULTS.weekStartDay
  }),
)

// Schema for range
const RangeSchema = withFallback(
  v.picklist(['rolling', 'year']),
  CONFIG_DEFAULTS.range,
)

// Schema for years (positive integer >= 1)
const YearsSchema = v.pipe(
  v.unknown(),
  v.transform((input) => {
    if (typeof input === 'number' && Number.isInteger(input) && input >= 1) {
      return input
    }
    return CONFIG_DEFAULTS.years
  }),
)

// Schema for levelCount (integer 2-10)
const LevelCountSchema = v.pipe(
  v.unknown(),
  v.transform((input) => {
    if (
      typeof input === 'number' &&
      Number.isInteger(input) &&
      input >= 2 &&
      input <= 10
    ) {
      return input
    }
    return CONFIG_DEFAULTS.levelCount
  }),
)

// Schema for missingMode
const MissingModeSchema = withFallback(
  v.picklist(['zero', 'transparent']),
  CONFIG_DEFAULTS.missingMode,
)

// Schema for valueMode
const ValueModeSchema = withFallback(
  v.picklist(['clamp_zero', 'range']),
  CONFIG_DEFAULTS.valueMode,
)

// Schema for weekdayLabels
const WeekdayLabelsSchema = withFallback(
  v.picklist(['none', 'short', 'all', 'letter']),
  CONFIG_DEFAULTS.weekdayLabels,
)

// Schema for baseColor (hex color with fallback)
const BaseColorSchema = v.pipe(
  v.unknown(),
  v.transform((input) => {
    if (typeof input === 'string' && HEX_COLOR_REGEX.test(input)) {
      return input
    }
    return CONFIG_DEFAULTS.baseColor
  }),
)

// Schema for optional hex color (undefined if invalid - for diverging colors)
const OptionalHexColorSchema = v.pipe(
  v.unknown(),
  v.transform((input): string | undefined => {
    if (typeof input === 'string' && HEX_COLOR_REGEX.test(input)) {
      return input
    }
    return undefined
  }),
)

// Schema for neutralValue (optional finite number)
const NeutralValueSchema = v.pipe(
  v.unknown(),
  v.transform((input): number | undefined => {
    if (typeof input === 'number' && Number.isFinite(input)) {
      return input
    }
    return undefined
  }),
)

// Schema for maxValue (optional positive finite number)
const MaxValueSchema = v.pipe(
  v.unknown(),
  v.transform((input): number | undefined => {
    if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
      return input
    }
    return undefined
  }),
)

// Schema for grid_options (HA sections view)
const GridOptionsSchema = v.optional(
  v.object({
    columns: v.optional(v.union([v.number(), v.literal('full')])),
    min_columns: v.optional(v.number()),
    max_columns: v.optional(v.number()),
    rows: v.optional(v.number()),
    min_rows: v.optional(v.number()),
    max_rows: v.optional(v.number()),
  }),
)

// Main config schema (keeping name for backward compatibility)
const HeatmapConfigSchema = v.pipe(
  v.object({
    // Required (but can be empty for preview mode)
    entity: v.pipe(v.string('You need to define an entity'), v.trim()),

    // Card type (required)
    card: v.picklist(['heatmap'], 'You need to define a card type'),

    // Optional with defaults
    title: v.optional(v.string()),
    show_legend: v.optional(v.boolean(), CONFIG_DEFAULTS.show_legend),
    attribute: v.optional(v.string(), CONFIG_DEFAULTS.attribute),
    range: v.optional(RangeSchema, CONFIG_DEFAULTS.range),
    years: v.optional(YearsSchema, CONFIG_DEFAULTS.years),
    end_date: v.optional(v.string()),
    weekStartDay: v.optional(WeekStartDaySchema, CONFIG_DEFAULTS.weekStartDay),
    weekdayLabels: v.optional(
      WeekdayLabelsSchema,
      CONFIG_DEFAULTS.weekdayLabels,
    ),
    levelCount: v.optional(LevelCountSchema, CONFIG_DEFAULTS.levelCount),
    levelThresholds: v.optional(v.array(v.number())),
    missingMode: v.optional(MissingModeSchema, CONFIG_DEFAULTS.missingMode),
    valueMode: v.optional(ValueModeSchema, CONFIG_DEFAULTS.valueMode),
    baseColor: v.optional(BaseColorSchema, CONFIG_DEFAULTS.baseColor),
    unit: v.optional(v.string()),
    backgroundColor: v.optional(v.string()),

    // Diverging color scheme (both required for diverging mode)
    negativeColor: v.optional(OptionalHexColorSchema),
    positiveColor: v.optional(OptionalHexColorSchema),
    neutralValue: v.optional(NeutralValueSchema),

    // Absolute max value for 100% intensity
    maxValue: v.optional(MaxValueSchema),

    grid_options: GridOptionsSchema,
  }),
  // Cross-field validation for levelThresholds
  v.transform((config) => {
    if (config.levelThresholds) {
      const expectedLength = config.levelCount - 1
      if (config.levelThresholds.length !== expectedLength) {
        // Wrong length - ignore thresholds (auto-calculate will be used)
        return { ...config, levelThresholds: undefined }
      }
    }
    return config
  }),
)

// Export the inferred type
export type CardConfig = v.InferOutput<typeof HeatmapConfigSchema>
// Backward compatibility alias
export type HeatmapConfig = CardConfig

/**
 * Validates and normalizes heatmap configuration.
 * Only throws for missing/invalid required fields.
 * Invalid optional values fall back to defaults.
 */
export function validateConfig(config: unknown): HeatmapConfig {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object')
  }

  const result = v.safeParse(HeatmapConfigSchema, config)

  if (!result.success) {
    const issue = result.issues[0]
    throw new Error(issue.message)
  }

  return result.output
}
