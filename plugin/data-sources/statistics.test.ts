import { describe, it, expect } from 'vitest'
import { aggregateStatistics, type StatisticsValue } from './statistics'
import { toLocalDateString } from '../shared/date'

describe('aggregateStatistics', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateStatistics([])).toEqual([])
  })

  it('returns empty array for null input', () => {
    expect(aggregateStatistics(null as unknown as StatisticsValue[])).toEqual(
      [],
    )
  })

  it('handles Unix timestamp in milliseconds for start field', () => {
    const stats: StatisticsValue[] = [
      {
        statistic_id: 'sensor.test',
        start: 1737982800000, // 2025-01-27T11:00:00.000Z
        end: 1738069200000,
        mean: null,
        min: null,
        max: null,
        sum: 100,
        state: 500,
        change: 50,
        last_reset: null,
      },
    ]

    const result = aggregateStatistics(stats, 'change')

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe(toLocalDateString(1737982800000)!)
    expect(result[0].count).toBe(50)
  })

  it('handles ISO string for start field', () => {
    const stats: StatisticsValue[] = [
      {
        statistic_id: 'sensor.test',
        start: '2025-01-27T11:00:00.000Z',
        end: '2025-01-28T11:00:00.000Z',
        mean: 25,
        min: 10,
        max: 40,
        sum: null,
        state: null,
        change: null,
        last_reset: null,
      },
    ]

    const result = aggregateStatistics(stats, 'max')

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe(toLocalDateString('2025-01-27T11:00:00.000Z')!)
    expect(result[0].count).toBe(40)
  })

  it('uses max by default for measurement sensors', () => {
    const stats: StatisticsValue[] = [
      {
        statistic_id: 'sensor.temperature',
        start: 1737982800000,
        end: 1738069200000,
        mean: 22,
        min: 18,
        max: 26,
        sum: null,
        state: null,
        change: null,
        last_reset: null,
      },
    ]

    const result = aggregateStatistics(stats, 'max')

    expect(result[0].count).toBe(26)
  })

  it('uses change for total_increasing sensors', () => {
    const stats: StatisticsValue[] = [
      {
        statistic_id: 'sensor.energy',
        start: 1737982800000,
        end: 1738069200000,
        mean: null,
        min: null,
        max: null,
        sum: 1000,
        state: 5000,
        change: 150,
        last_reset: null,
      },
    ]

    const result = aggregateStatistics(stats, 'change')

    expect(result[0].count).toBe(150)
  })

  it('skips entries with null values for requested type', () => {
    const stats: StatisticsValue[] = [
      {
        statistic_id: 'sensor.test',
        start: 1737982800000,
        end: 1738069200000,
        mean: null,
        min: null,
        max: null, // null - should be skipped
        sum: 100,
        state: 500,
        change: 50,
        last_reset: null,
      },
    ]

    const result = aggregateStatistics(stats, 'max')

    expect(result).toHaveLength(0)
  })

  it('handles multiple days and sorts by date', () => {
    const stats: StatisticsValue[] = [
      {
        statistic_id: 'sensor.test',
        start: 1738069200000, // 2025-01-28
        end: 1738155600000,
        mean: null,
        min: null,
        max: null,
        sum: null,
        state: null,
        change: 30,
        last_reset: null,
      },
      {
        statistic_id: 'sensor.test',
        start: 1737982800000, // 2025-01-27
        end: 1738069200000,
        mean: null,
        min: null,
        max: null,
        sum: null,
        state: null,
        change: 50,
        last_reset: null,
      },
    ]

    const result = aggregateStatistics(stats, 'change')

    expect(result).toHaveLength(2)
    expect(result[0].date).toBe(toLocalDateString(1737982800000)!)
    expect(result[0].count).toBe(50)
    expect(result[1].date).toBe(toLocalDateString(1738069200000)!)
    expect(result[1].count).toBe(30)
  })
})
