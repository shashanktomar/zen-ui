import { LitElement, html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import {
  processHeatmapData,
  calculateDateRanges,
  type PipelineConfig,
} from './data-pipeline'
import {
  generateColorScale,
  generateDivergingColorScale,
  isValidHexColor,
} from './color-utils'
import { validateConfig, weekStartDayToNumber, type CardConfig } from './config'
import { baseStyles } from './shared/styles'
import { t } from './shared/localize'
import { getCardRenderer, getAllCardStyles } from './cards/registry'
import type { Tooltip, CardRenderContext } from './cards/types'
import {
  fetchStatistics,
  aggregateStatistics,
  getAttributeData,
  type DataPoint,
  type Hass,
} from './data-sources'

// Injected by Vite at build time from package.json
declare const __VERSION__: string

console.info(
  `%c ZEN-UI %c ${__VERSION__} `,
  'color: #5c5f77; background: #ea76cb; font-weight: bold; padding: 2px 4px; border-radius: 4px 0 0 4px;',
  'color: #ea76cb; background: #5c5f77; font-weight: bold; padding: 2px 4px; border-radius: 0 4px 4px 0;',
)

// Register with Home Assistant card picker
declare global {
  interface Window {
    customCards?: Array<{
      type: string
      name: string
      description?: string
      preview?: boolean
      documentationURL?: string
    }>
  }
}

window.customCards = window.customCards || []
window.customCards.push({
  type: 'zen-ui',
  name: 'Zen UI',
  description: 'GitHub-style contribution heatmap for tracking daily metrics',
  preview: true,
  documentationURL: 'https://github.com/shashanktomar/zen-ui',
})

@customElement('zen-ui')
export class ZenUI extends LitElement {
  @property({ attribute: false }) public hass?: Hass

  @state() private _config?: CardConfig
  @state() private _darkMode = false
  @state() private _tooltip?: Tooltip
  @state() private _historyData: DataPoint[] = []
  @state() private _loading = false
  @state() private _error?: string

  private _darkModeMediaQuery?: MediaQueryList
  private _darkModeObserver?: MutationObserver
  private _lastFetchedEntity?: string

  static styles = [baseStyles, ...getAllCardStyles()]

  static getStubConfig() {
    return {
      type: 'custom:zen-ui',
      card: 'heatmap',
      entity: '',
      title: 'Preview',
    }
  }

  public setConfig(config: unknown): void {
    this._config = validateConfig(config)
  }

  public getCardSize(): number {
    if (!this._config) return 3
    const renderer = getCardRenderer(this._config.card)
    return renderer.getCardSize(this._config)
  }

  public getGridOptions() {
    return {
      columns: this._config?.grid_options?.columns ?? 'full',
      min_columns: this._config?.grid_options?.min_columns ?? 6,
      min_rows: this._config?.grid_options?.min_rows ?? 2,
    }
  }

  updated(changedProps: Map<string, unknown>): void {
    if (changedProps.has('hass')) {
      this._updateDarkMode()
      this._fetchHistoryIfNeeded()
    }
  }

  connectedCallback(): void {
    super.connectedCallback()
    this._setupDarkModeDetection()
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    this._cleanupDarkModeDetection()
  }

  private _setupDarkModeDetection(): void {
    // Listen for media query changes
    this._darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    this._darkModeMediaQuery.addEventListener('change', this._onDarkModeChange)

    // Observe body/html for class changes (for HA and demo toggle)
    this._darkModeObserver = new MutationObserver(this._onDarkModeChange)
    this._darkModeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    })
    this._darkModeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    // Initial detection
    this._updateDarkMode()
  }

  private _cleanupDarkModeDetection(): void {
    this._darkModeMediaQuery?.removeEventListener(
      'change',
      this._onDarkModeChange,
    )
    this._darkModeObserver?.disconnect()
  }

  private _onDarkModeChange = (): void => {
    this._updateDarkMode()
  }

  private _updateDarkMode(): void {
    this._darkMode = this._detectDarkMode()
  }

  private _detectDarkMode(): boolean {
    // Check Home Assistant theme (preferred method)
    if (this.hass?.themes?.darkMode !== undefined) {
      return this.hass.themes.darkMode
    }
    // Check for .dark class on body or html (for demo/preview pages)
    if (
      document.body.classList.contains('dark') ||
      document.documentElement.classList.contains('dark')
    ) {
      return true
    }
    // If no HA theme and no .dark class, default to light mode
    // This ensures demo/preview pages start in light mode
    // regardless of system preference
    return false
  }

  private _fetchHistoryIfNeeded(): void {
    if (!this._config?.entity || !this.hass) return

    // Only fetch if entity changed
    if (this._lastFetchedEntity === this._config.entity) return

    this._lastFetchedEntity = this._config.entity
    this._fetchStatistics()
  }

  private async _fetchStatistics(): Promise<void> {
    if (!this._config?.entity || !this.hass) return

    // Skip if hass.callWS is not available (e.g., demo mode)
    if (typeof this.hass.callWS !== 'function') return

    this._loading = true
    this._error = undefined

    try {
      // Calculate date range using pipeline logic to ensure consistency
      const pipelineConfig = this._getPipelineConfig()
      const ranges = calculateDateRanges(pipelineConfig)
      const startDate = ranges[0].startDate
      const endDate = ranges[ranges.length - 1].endDate

      // Use statistics API for long-term data (not limited by purge_keep_days)
      const statistics = await fetchStatistics(this.hass, {
        entityId: this._config.entity,
        startDate,
        endDate,
        period: 'day',
      })

      // Pick statistics type based on sensor's state_class
      const statisticsType = this._getStatisticsType()
      this._historyData = aggregateStatistics(statistics, statisticsType)
    } catch (err) {
      console.error('Failed to fetch statistics:', err)
      this._error = 'Failed to load statistics data'
      this._historyData = []
    } finally {
      this._loading = false
    }
  }

  private _getStatisticsType(): 'max' | 'mean' | 'change' | 'state' {
    if (!this._config?.entity || !this.hass) return 'max'

    const stateObj = this.hass.states[this._config.entity]
    const stateClass = stateObj?.attributes?.state_class

    // state_class: total or total_increasing → use 'change' (daily delta)
    // state_class: measurement → use 'max'
    if (stateClass === 'total' || stateClass === 'total_increasing') {
      return 'change'
    }

    return 'max'
  }

  private _getRawData(): DataPoint[] {
    if (!this._config) return []

    // Preview mode: no entity configured, generate mock data
    if (!this._config.entity) {
      return this._generateMockData()
    }

    // Check for data in entity attribute first (for custom sensors with data attribute)
    if (this.hass) {
      const attributeData = getAttributeData(this.hass, {
        entityId: this._config.entity,
        attribute: this._config.attribute || 'data',
      })
      if (attributeData.length > 0) {
        return attributeData
      }
    }

    // Use fetched history data
    if (this._historyData.length > 0) {
      return this._historyData
    }

    // No data available
    return []
  }

  private _generateMockData(): DataPoint[] {
    const data: Array<{ date: string; count: number }> = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Simple seeded pseudo-random for deterministic results
    const seed = 12345
    let rand = seed
    const random = () => {
      rand = (rand * 1103515245 + 12345) & 0x7fffffff
      return rand / 0x7fffffff
    }

    for (let i = 0; i < 365; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)

      const weekday = date.getDay()
      const weekNum = Math.floor(i / 7)

      // Base activity varies by week (some weeks busier than others)
      const weekActivity = Math.sin(weekNum * 0.3) * 0.3 + 0.5

      // Weekdays more active than weekends
      const dayFactor = weekday >= 1 && weekday <= 5 ? 1.0 : 0.4

      // Random variation
      const noise = random()

      // Combine factors - creates values roughly 0-12
      const value = Math.floor(noise * weekActivity * dayFactor * 15)

      // Skip ~25% of days randomly for realism
      if (random() > 0.25 && value > 0) {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')

        data.push({
          date: `${year}-${month}-${day}`,
          count: value,
        })
      }
    }

    return data
  }

  /**
   * Checks if diverging color mode is enabled.
   * Requires both negativeColor and positiveColor to be valid hex colors.
   */
  private _isDiverging(): boolean {
    if (!this._config) return false
    return (
      isValidHexColor(this._config.negativeColor) &&
      isValidHexColor(this._config.positiveColor)
    )
  }

  /**
   * Gets the effective level count, adjusting for diverging mode requirements.
   * Diverging mode requires odd levelCount >= 3.
   */
  private _getEffectiveLevelCount(): number {
    const config = this._config!
    let levelCount = config.levelCount ?? 5

    if (this._isDiverging()) {
      levelCount = Math.max(3, levelCount)
      if (levelCount % 2 === 0) levelCount++
    }

    return levelCount
  }

  private _getPipelineConfig(): PipelineConfig {
    const config = this._config!
    const today = config.end_date ? new Date(config.end_date) : new Date()
    const isDiverging = this._isDiverging()
    const originalLevelCount = config.levelCount ?? 5
    const effectiveLevelCount = this._getEffectiveLevelCount()

    // Warn if diverging overrides clamp_zero
    if (isDiverging && config.valueMode === 'clamp_zero') {
      console.warn(
        'zen-ui: diverging colors require valueMode "range", ignoring clamp_zero',
      )
    }

    // Drop thresholds if levelCount was adjusted for diverging
    let levelThresholds = config.levelThresholds
    if (
      isDiverging &&
      config.levelThresholds &&
      effectiveLevelCount !== originalLevelCount
    ) {
      console.warn(
        'zen-ui: levelThresholds ignored because levelCount was adjusted for diverging mode',
      )
      levelThresholds = undefined
    }

    return {
      mode: config.range === 'year' ? 'fixed' : 'rolling',
      years: config.years,
      targetYear: today.getFullYear(),
      weekStartDay: weekStartDayToNumber(config.weekStartDay),
      levelCount: effectiveLevelCount,
      levelThresholds,
      missingMode: config.missingMode,
      // Force range mode for diverging
      valueMode: isDiverging ? 'range' : config.valueMode,
      isDiverging,
      neutralValue: config.neutralValue,
      maxValue: config.maxValue,
    }
  }

  private _getColorScale(neutralLevel?: number): string[] {
    const config = this._config!
    const effectiveLevelCount = this._getEffectiveLevelCount()

    if (this._isDiverging()) {
      return generateDivergingColorScale(
        config.negativeColor!,
        config.positiveColor!,
        effectiveLevelCount,
        neutralLevel ?? Math.floor(effectiveLevelCount / 2),
        { darkMode: this._darkMode },
      )
    }

    return generateColorScale(config.baseColor, effectiveLevelCount, {
      darkMode: this._darkMode,
    })
  }

  private _onCellMouseEnter = (
    e: MouseEvent,
    date: string,
    count: number,
    missing?: boolean,
  ): void => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect()
    this._tooltip = {
      x: rect.left + rect.width / 2,
      y: rect.top,
      date,
      count,
      missing,
    }
  }

  private _onCellMouseLeave = (): void => {
    this._tooltip = undefined
  }

  private _getLocale(): string {
    return this.hass?.locale?.language ?? 'en'
  }

  private _formatTooltipDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString(this._getLocale(), {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  private _getUnit(): string | undefined {
    if (!this._config) return undefined
    // Config unit takes precedence over auto-detected unit
    if (this._config.unit) return this._config.unit
    // Auto-detect from entity's unit_of_measurement attribute
    const stateObj = this.hass?.states[this._config.entity]
    return stateObj?.attributes?.unit_of_measurement as string | undefined
  }

  render() {
    if (!this._config) return html``

    const cardStyle = this._config.backgroundColor
      ? `background-color: ${this._config.backgroundColor};`
      : ''

    // Show loading state
    if (this._loading) {
      return html`
        <ha-card style="${cardStyle}">
          ${this._config.title
            ? html`<div class="header">${this._config.title}</div>`
            : ''}
          <div class="loading">${t('loading', this._getLocale())}</div>
        </ha-card>
      `
    }

    // Show error state
    if (this._error) {
      return html`
        <ha-card style="${cardStyle}">
          ${this._config.title
            ? html`<div class="header">${this._config.title}</div>`
            : ''}
          <div class="error">${t('error', this._getLocale())}</div>
        </ha-card>
      `
    }

    const renderer = getCardRenderer(this._config.card)
    const rawData = this._getRawData()
    const pipelineConfig = this._getPipelineConfig()
    const data = processHeatmapData(pipelineConfig, rawData)
    // Get neutralLevel from first heatmap data (all should have same neutralLevel)
    const neutralLevel = data[0]?.neutralLevel
    const colorScale = this._getColorScale(neutralLevel)

    if (data.length === 0) {
      return html`
        <ha-card style="${cardStyle}">
          ${this._config.title
            ? html`<div class="header">${this._config.title}</div>`
            : ''}
          <div class="empty">${t('noData', this._getLocale())}</div>
        </ha-card>
      `
    }

    const context: CardRenderContext = {
      config: this._config,
      data,
      colorScale,
      darkMode: this._darkMode,
      locale: this._getLocale(),
      tooltip: this._tooltip,
      onCellMouseEnter: this._onCellMouseEnter,
      onCellMouseLeave: this._onCellMouseLeave,
    }

    return html`
      <ha-card style="${cardStyle}">
        ${this._config.title
          ? html`<div class="header">${this._config.title}</div>`
          : ''}
        ${renderer.render(context)}
      </ha-card>
      ${this._tooltip
        ? html`
            <div
              class="tooltip"
              style="left: ${this._tooltip.x}px; top: ${this._tooltip.y}px;"
            >
              <div class="tooltip-date">
                ${this._formatTooltipDate(this._tooltip.date)}
              </div>
              <div class="tooltip-count">
                ${this._tooltip.missing
                  ? t('missing', this._getLocale())
                  : `${this._tooltip.count.toFixed(2)}${this._getUnit() ? ` ${this._getUnit()}` : ''}`}
              </div>
            </div>
          `
        : ''}
    `
  }
}
