/**
 * Heatmap Rendering Logic
 *
 * Pure rendering functions for the heatmap card.
 */

import { html, svg, type TemplateResult } from 'lit'
import type { HeatmapData } from '../../data-pipeline'
import type { CardRenderContext } from '../types'

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
      const name = new Date(2000, month, 1).toLocaleString('default', {
        month: 'short',
      })
      labels.push(svg`<text x="${col * STEP}" y="-7">${name}</text>`)
      lastLabelPos = col
    }
  }

  const width = heatmapData.weeks.length * STEP - GAP
  const height = 7 * STEP - GAP

  // Day labels based on week start day
  const dayLabels =
    weekStart === 0
      ? [
          { row: 1, label: 'Mon' },
          { row: 3, label: 'Wed' },
          { row: 5, label: 'Fri' },
        ]
      : [
          { row: 1, label: 'Tue' },
          { row: 3, label: 'Thu' },
          { row: 5, label: 'Sat' },
        ]

  const yearLabel = heatmapData.range.label || ''

  return html`
    <div class="year-graph">
      ${showYearLabel ? html`<div class="year-label">${yearLabel}</div>` : ''}
      <svg viewBox="0 0 ${X_START + width + 5} ${Y_START + height + 2}">
        <g transform="translate(${X_START}, ${Y_START})">
          ${labels}
          ${heatmapData.weeks.map(
            (week, wIndex) => svg`
                <g transform="translate(${wIndex * STEP}, 0)">
                    ${week.map((day) => {
                      // Calculate row position from actual day-of-week
                      const dayOfWeek = new Date(day.date).getDay()
                      const rowIndex =
                        weekStart === 0 ? dayOfWeek : (dayOfWeek + 6) % 7
                      const color =
                        colorScale[day.level] ??
                        colorScale[colorScale.length - 1]
                      return svg`
                            <rect
                                width="${RECT_SIZE}"
                                height="${RECT_SIZE}"
                                x="0"
                                y="${rowIndex * STEP}"
                                fill="${color}"
                                style="cursor: pointer;"
                                @mouseenter=${(e: MouseEvent) => context.onCellMouseEnter(e, day.date, day.count)}
                                @mouseleave=${context.onCellMouseLeave}
                            />
                        `
                    })}
                </g>
            `,
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

export function renderLegend(colorScale: string[]): TemplateResult {
  const legendItems = colorScale.map((color) => {
    const style =
      color === 'transparent'
        ? 'background-color: transparent; border: 1px solid var(--secondary-text-color);'
        : `background-color: ${color};`
    return html`<div class="legend-item" style="${style}"></div>`
  })

  return html`
    <div class="legend">
      <span>Less</span>
      ${legendItems}
      <span>More</span>
    </div>
  `
}
