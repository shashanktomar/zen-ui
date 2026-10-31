/**
 * Heatmap Card Renderer
 *
 * Renders a GitHub-style contribution heatmap.
 */

import { html } from 'lit'
import type { CardRenderer, CardRenderContext } from '../types'
import { heatmapStyles } from './styles'
import { renderYearGraph, renderLegend, type LegendOptions } from './render'
import { isValidHexColor } from '../../color-utils'

export const heatmapCard: CardRenderer = {
  styles: heatmapStyles,

  getCardSize(config) {
    if (config.range === 'year') return 3 * (config.years ?? 1)
    const days = config.days ?? 364
    if (days <= 30) return 2
    return 3
  },

  render(context: CardRenderContext) {
    const { config, data, colorScale, locale } = context
    const isYearMode = config.range === 'year'
    const showYearLabels = data.length > 1

    // Check if diverging mode is enabled
    const isDiverging =
      isValidHexColor(config.negativeColor) &&
      isValidHexColor(config.positiveColor)

    // Get min/max from first data range (all ranges should have similar scale).
    // With percentile scaling, show the scale bounds and mark clipped ends.
    const first = data[0]
    const bounds = first?.scaleBounds
    const legendOptions: LegendOptions | undefined = isDiverging
      ? {
          isDiverging: true,
          minValue: bounds?.min ?? first?.minCount,
          maxValue: bounds?.max ?? first?.maxCount,
          minClipped: !!bounds && (first?.minCount ?? 0) < bounds.min,
          maxClipped: !!bounds && first.maxCount > bounds.max,
        }
      : undefined

    return html`
      <div class="graph-container">
        ${data.map((heatmapData) =>
          renderYearGraph(
            heatmapData,
            colorScale,
            context,
            isYearMode,
            showYearLabels,
          ),
        )}
        ${config.show_legend !== false
          ? renderLegend(colorScale, locale, legendOptions)
          : ''}
      </div>
    `
  },
}
