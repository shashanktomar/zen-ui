/**
 * Data Sources - History API
 *
 * Fetches historical data from Home Assistant's history API.
 */

import type { Hass, HassHistoryEntry, DataPoint } from './types'
import { toLocalDateString } from '../shared/date'

export interface FetchHistoryOptions {
  entityId: string
  startDate: Date
  endDate: Date
}

/**
 * Fetches history from Home Assistant REST API
 * Uses the same approach as apexcharts-card
 */
export async function fetchHistory(
  hass: Hass,
  options: FetchHistoryOptions,
): Promise<HassHistoryEntry[]> {
  const { entityId, startDate, endDate } = options

  let url = `history/period/${startDate.toISOString()}`
  url += `?filter_entity_id=${entityId}`
  url += `&end_time=${endDate.toISOString()}`
  url += '&significant_changes_only=0'

  const history = await hass.callApi('GET', url)

  if (
    !history ||
    !Array.isArray(history) ||
    history.length === 0 ||
    !history[0]
  ) {
    return []
  }

  return history[0] as HassHistoryEntry[]
}

/**
 * Aggregates history entries into daily data points
 * Uses max value per day for aggregation
 */
export function aggregateHistory(history: HassHistoryEntry[]): DataPoint[] {
  if (!history || history.length === 0) return []

  // Group by date and collect values
  const dailyData = new Map<string, number[]>()

  for (const entry of history) {
    if (!entry.state || !entry.last_changed) continue

    const state = parseFloat(entry.state)
    if (isNaN(state)) continue // Skip non-numeric states (e.g., 'unavailable')

    const date = toLocalDateString(entry.last_changed)
    if (!date) continue

    if (!dailyData.has(date)) {
      dailyData.set(date, [])
    }
    dailyData.get(date)!.push(state)
  }

  // Convert to array with aggregated values (using max for each day)
  const result: DataPoint[] = []
  for (const [date, values] of dailyData) {
    const maxValue = Math.max(...values)
    result.push({ date, count: maxValue })
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}
