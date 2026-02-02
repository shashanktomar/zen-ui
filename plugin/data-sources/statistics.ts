/**
 * Data Sources - Statistics API
 *
 * Fetches long-term statistics from Home Assistant's recorder.
 * Unlike history API (limited to purge_keep_days), statistics are stored indefinitely.
 * Only works for sensors with state_class attribute.
 */

import type { Hass, DataPoint } from './types'
import { toLocalDateString } from '../shared/date'

export type StatisticsPeriod = '5minute' | 'hour' | 'day' | 'week' | 'month'
export type StatisticsType = 'mean' | 'min' | 'max' | 'sum' | 'state' | 'change'

export interface StatisticsValue {
  statistic_id: string
  start: string | number // ISO string or Unix timestamp (milliseconds)
  end: string | number
  mean: number | null
  min: number | null
  max: number | null
  sum: number | null
  state: number | null
  change: number | null
  last_reset: string | null
}

export interface FetchStatisticsOptions {
  entityId: string
  startDate: Date
  endDate: Date
  period?: StatisticsPeriod
  statisticsType?: StatisticsType
}

/**
 * Fetches long-term statistics from Home Assistant via WebSocket
 */
export async function fetchStatistics(
  hass: Hass,
  options: FetchStatisticsOptions,
): Promise<StatisticsValue[]> {
  const { entityId, startDate, endDate, period = 'day' } = options

  const result = await hass.callWS({
    type: 'recorder/statistics_during_period',
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
    statistic_ids: [entityId],
    period,
  })

  const statistics = result as Record<string, StatisticsValue[]>

  if (!statistics || !statistics[entityId]) {
    return []
  }

  return statistics[entityId]
}

/**
 * Aggregates statistics into daily data points
 */
export function aggregateStatistics(
  statistics: StatisticsValue[],
  type: StatisticsType = 'max',
): DataPoint[] {
  if (!statistics || statistics.length === 0) return []

  const result: DataPoint[] = []

  for (const stat of statistics) {
    const value = stat[type]
    if (value === null || value === undefined) continue

    // Extract date from start - can be ISO string or Unix timestamp (milliseconds)
    const date = toLocalDateString(stat.start)
    if (!date) continue

    result.push({ date, count: value })
  }

  return result.sort((a, b) => a.date.localeCompare(b.date))
}
