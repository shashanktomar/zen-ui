/**
 * Heatmap Card Renderer
 *
 * Renders a GitHub-style contribution heatmap.
 */

import { html } from 'lit'
import type { CardRenderer, CardRenderContext } from '../types'
import { heatmapStyles } from './styles'
import { renderYearGraph, renderLegend } from './render'

export const heatmapCard: CardRenderer = {
  styles: heatmapStyles,

  getCardSize(config) {
    return config.range === 'year' ? 3 * (config.years ?? 1) : 3
  },

  render(context: CardRenderContext) {
    const { config, data, colorScale, locale } = context
    const isYearMode = config.range === 'year'
    const showYearLabels = data.length > 1

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
        ${config.show_legend !== false ? renderLegend(colorScale, locale) : ''}
      </div>
    `
  },
}
