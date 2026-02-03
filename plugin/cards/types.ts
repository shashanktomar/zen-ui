/**
 * Card Renderer Interface
 *
 * Defines the contract for all card type renderers.
 */

import type { CSSResult, TemplateResult } from 'lit'
import type { CardConfig } from '../config'
import type { HeatmapData } from '../data-pipeline'

export interface Tooltip {
  x: number
  y: number
  date: string
  count: number
  missing?: boolean
}

export interface CardRenderContext {
  config: CardConfig
  data: HeatmapData[]
  colorScale: string[]
  darkMode: boolean
  locale: string
  tooltip?: Tooltip
  onCellMouseEnter: (
    e: MouseEvent,
    date: string,
    count: number,
    missing?: boolean,
  ) => void
  onCellMouseLeave: () => void
}

export interface CardRenderer {
  render(context: CardRenderContext): TemplateResult
  styles: CSSResult
  getCardSize(config: CardConfig): number
}
