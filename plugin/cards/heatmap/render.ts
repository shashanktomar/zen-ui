/**
 * Heatmap Rendering Logic
 *
 * Pure rendering functions for the heatmap card.
 */

import { html, svg, type TemplateResult } from 'lit'
import type { HeatmapData } from '../../data-pipeline'
import type { CardRenderContext } from '../types'
import type { WeekdayLabelsMode } from '../../config'
import { calculateGridPositions } from './grid'
import { t } from '../../shared/localize'
import { parseYmdDate } from '../../shared/date'

const RECT_SIZE = 10
const GAP = 3
const STEP = RECT_SIZE + GAP
const X_START = 30
const Y_START = 20

export interface DayLabel {
  row: number
  label: string
}

/**
 * Gets the localized day label for a given day index.
 * dayIndex: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
 */
export function getDayLabel(
  dayIndex: number,
  locale: string,
  mode: WeekdayLabelsMode,
): string {
  // Jan 2, 2000 = Sunday, so dayIndex 0=Sun, 1=Mon, etc.
  const d = new Date(Date.UTC(2000, 0, 2 + dayIndex))
  const weekdayFormat = mode === 'letter' ? 'narrow' : 'short'
  return d.toLocaleString(locale, {
    weekday: weekdayFormat,
    timeZone: 'UTC',
  })
}

/**
 * Generates day labels based on the weekday labels mode and week start day.
 * weekStart: 0=Sunday, 1=Monday
 */
export function generateDayLabels(
  mode: WeekdayLabelsMode,
  weekStart: 0 | 1,
  locale: string,
): DayLabel[] {
  if (mode === 'none') return []

  if (mode === 'all' || mode === 'letter') {
    // Show all 7 days
    return [0, 1, 2, 3, 4, 5, 6].map((row) => ({
      row,
      label: getDayLabel((row + weekStart) % 7, locale, mode),
    }))
  }

  // Default 'short' - alternating labels (every other day starting from row 1)
  return weekStart === 0
    ? [
        { row: 1, label: getDayLabel(1, locale, mode) }, // Mon
        { row: 3, label: getDayLabel(3, locale, mode) }, // Wed
        { row: 5, label: getDayLabel(5, locale, mode) }, // Fri
      ]
    : [
        { row: 1, label: getDayLabel(2, locale, mode) }, // Tue
        { row: 3, label: getDayLabel(4, locale, mode) }, // Thu
        { row: 5, label: getDayLabel(6, locale, mode) }, // Sat
      ]
}

export function renderYearGraph(
  heatmapData: HeatmapData,
  colorScale: string[],
  context: CardRenderContext,
  isYearMode: boolean,
  showYearLabel: boolean,
): TemplateResult {
  const weekStart = context.config.weekStartDay === 'sunday' ? 0 : 1

  // Build month labels from the processed weeks
  const monthStartColumns = new Map<number, number>()

  heatmapData.weeks.forEach((week, colIndex) => {
    for (const day of week) {
      const date = parseYmdDate(day.date) ?? new Date(day.date)
      if (date.getDate() === 1) {
        const month = date.getMonth()
        if (!monthStartColumns.has(month)) {
          monthStartColumns.set(month, colIndex)
        }
      }
    }
  })

  // Generate month labels
  const labels: TemplateResult[] = []
  const sortedMonths = Array.from(monthStartColumns.entries()).sort(
    (a, b) => a[1] - b[1],
  )

  // For year mode, ensure Jan is labeled at column 0 if not found
  if (isYearMode && !monthStartColumns.has(0)) {
    sortedMonths.unshift([0, 0])
  }

  let lastLabelPos = -999
  for (const [month, col] of sortedMonths) {
    if (col - lastLabelPos > 2) {
      const name = new Date(Date.UTC(2000, month, 1)).toLocaleString(
        context.locale,
        {
          month: 'short',
          timeZone: 'UTC',
        },
      )
      labels.push(svg`<text x="${col * STEP}" y="-7">${name}</text>`)
      lastLabelPos = col
    }
  }

  const width = heatmapData.weeks.length * STEP - GAP
  const height = 7 * STEP - GAP

  const dayLabels = generateDayLabels(
    context.config.weekdayLabels,
    weekStart,
    context.locale,
  )

  const yearLabel = heatmapData.range.label || ''

  return html`
    <div class="year-graph">
      ${showYearLabel ? html`<div class="year-label">${yearLabel}</div>` : ''}
      <svg viewBox="0 0 ${X_START + width + 5} ${Y_START + height + 2}">
        <g transform="translate(${X_START}, ${Y_START})">
          ${labels}
          ${calculateGridPositions(heatmapData.weeks.flat(), weekStart).map(
            ({ day, row, col }) => {
              // Missing days are rendered with a subtle placeholder color
              const color = day.missing
                ? 'rgba(128, 128, 128, 0.02)'
                : (colorScale[day.level] ?? colorScale[colorScale.length - 1])
              return svg`
                <rect
                  width="${RECT_SIZE}"
                  height="${RECT_SIZE}"
                  x="${col * STEP}"
                  y="${row * STEP}"
                  fill="${color}"
                  style="cursor: pointer;"
                  @mouseenter=${(e: MouseEvent) => context.onCellMouseEnter(e, day.date, day.count, day.missing)}
                  @mouseleave=${context.onCellMouseLeave}
                />
              `
            },
          )}
          ${dayLabels.map(
            ({ row, label }) => svg`
                <text x="-5" y="${row * STEP + 9}" text-anchor="end" style="font-size: 9px;">${label}</text>
            `,
          )}
        </g>
      </svg>
    </div>
  `
}

export interface LegendOptions {
  isDiverging?: boolean
  minValue?: number
  maxValue?: number
}

/**
 * Formats a value for diverging legend display.
 * Positive values get a "+" prefix, zero is just "0", negatives have "-".
 * Uses locale-aware formatting with reasonable precision.
 */
function formatDivergingValue(val: number, locale: string): string {
  const isInteger = Number.isInteger(val)
  const formatted = isInteger
    ? val.toLocaleString(locale)
    : val.toLocaleString(locale, { maximumFractionDigits: 1 })

  if (val > 0) return `+${formatted}`
  if (val === 0) return '0'
  return formatted // negative already has "-"
}

export function renderLegend(
  colorScale: string[],
  locale: string,
  options?: LegendOptions,
): TemplateResult {
  const { isDiverging, minValue, maxValue } = options ?? {}

  const legendItems = colorScale.map((color) => {
    const style =
      color === 'transparent'
        ? 'background-color: transparent; border: 1px solid var(--secondary-text-color);'
        : `background-color: ${color};`
    return html`<div class="legend-item" style="${style}"></div>`
  })

  // For diverging mode, show actual min/max values if available
  const hasValidRange =
    typeof minValue === 'number' &&
    typeof maxValue === 'number' &&
    Number.isFinite(minValue) &&
    Number.isFinite(maxValue)

  const minLabel =
    isDiverging && hasValidRange
      ? formatDivergingValue(minValue, locale)
      : t('less', locale)
  const maxLabel =
    isDiverging && hasValidRange
      ? formatDivergingValue(maxValue, locale)
      : t('more', locale)

  return html`
    <div class="legend">
      <span>${minLabel}</span>
      ${legendItems}
      <span>${maxLabel}</span>
    </div>
  `
}
