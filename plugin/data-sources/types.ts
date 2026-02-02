/**
 * Data Sources - Shared Types
 */

// Common data point format used across the card
export interface DataPoint {
  date: string // YYYY-MM-DD
  count: number
}

// Home Assistant entity state
export interface HassEntity {
  state: string
  attributes: Record<string, unknown>
  last_changed: string
  last_updated: string
}

// Home Assistant history entry from REST API
export interface HassHistoryEntry {
  state: string
  last_changed: string
  last_updated: string
  attributes?: Record<string, unknown>
}

// Hass object interface (minimal typing for what we use)
export interface Hass {
  states: Record<string, HassEntity>
  callApi: (method: string, path: string) => Promise<unknown>
  callWS: (params: Record<string, unknown>) => Promise<unknown>
  themes?: {
    darkMode?: boolean
  }
  locale?: {
    language: string
  }
}

// Data source result
export interface DataSourceResult {
  data: DataPoint[]
  error?: string
}
