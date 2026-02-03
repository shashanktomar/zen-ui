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
    return config.range === 'year' ? 3 * (config.years ?? 1) : 3
  },

  render(context: CardRenderContext) {
    const { config, data, colorScale, locale } = context
    const isYearMode = config.range === 'year'
    const showYearLabels = data.length > 1

    // Check if diverging mode is enabled
    const isDiverging =
      isValidHexColor(config.negativeColor) &&
      isValidHexColor(config.positiveColor)

    // Get min/max from first data range (all ranges should have similar scale)
    const legendOptions: LegendOptions | undefined = isDiverging
      ? {
          isDiverging: true,
          minValue: data[0]?.minCount,
          maxValue: data[0]?.maxCount,
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
