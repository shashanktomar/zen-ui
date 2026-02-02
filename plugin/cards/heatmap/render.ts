/**
 * Heatmap Rendering Logic
 *
 * Pure rendering functions for the heatmap card.
 */

import { html, svg, type TemplateResult } from 'lit'
import type { HeatmapData } from '../../data-pipeline'
import type { CardRenderContext } from '../types'
import { calculateGridPositions } from './grid'
import { t } from '../../shared/localize'

const RECT_SIZE = 10
const GAP = 3
const STEP = RECT_SIZE + GAP
const X_START = 30
const Y_START = 20

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
      const date = new Date(day.date)
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

  // Day labels based on week start day (using UTC to avoid DST issues)
  const getDayLabel = (dayIndex: number): string => {
    // Jan 2, 2000 = Sunday, so dayIndex 0=Sun, 1=Mon, etc.
    const d = new Date(Date.UTC(2000, 0, 2 + dayIndex))
    return d.toLocaleString(context.locale, {
      weekday: 'short',
      timeZone: 'UTC',
    })
  }

  const dayLabels =
    weekStart === 0
      ? [
          { row: 1, label: getDayLabel(1) }, // Mon
          { row: 3, label: getDayLabel(3) }, // Wed
          { row: 5, label: getDayLabel(5) }, // Fri
        ]
      : [
          { row: 1, label: getDayLabel(2) }, // Tue
          { row: 3, label: getDayLabel(4) }, // Thu
          { row: 5, label: getDayLabel(6) }, // Sat
        ]

  const yearLabel = heatmapData.range.label || ''

  return html`
    <div class="year-graph">
      ${showYearLabel ? html`<div class="year-label">${yearLabel}</div>` : ''}
      <svg viewBox="0 0 ${X_START + width + 5} ${Y_START + height + 2}">
        <g transform="translate(${X_START}, ${Y_START})">
          ${labels}
          ${calculateGridPositions(heatmapData.weeks.flat(), weekStart).map(
            ({ day, row, col }) => {
              const color =
                colorScale[day.level] ?? colorScale[colorScale.length - 1]
              return svg`
                <rect
                  width="${RECT_SIZE}"
                  height="${RECT_SIZE}"
                  x="${col * STEP}"
                  y="${row * STEP}"
                  fill="${color}"
                  style="cursor: pointer;"
                  @mouseenter=${(e: MouseEvent) => context.onCellMouseEnter(e, day.date, day.count)}
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

export function renderLegend(
  colorScale: string[],
  locale: string,
): TemplateResult {
  const legendItems = colorScale.map((color) => {
    const style =
      color === 'transparent'
        ? 'background-color: transparent; border: 1px solid var(--secondary-text-color);'
        : `background-color: ${color};`
    return html`<div class="legend-item" style="${style}"></div>`
  })

  return html`
    <div class="legend">
      <span>${t('less', locale)}</span>
      ${legendItems}
      <span>${t('more', locale)}</span>
    </div>
  `
}
