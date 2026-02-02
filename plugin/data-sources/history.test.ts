import { describe, it, expect } from 'vitest'
import { aggregateHistory } from './history'
import type { HassHistoryEntry } from './types'

describe('aggregateHistory', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateHistory([])).toEqual([])
  })

  it('returns empty array for null input', () => {
    expect(aggregateHistory(null as unknown as HassHistoryEntry[])).toEqual([])
  })

  it('aggregates single day with max value', () => {
    const history: HassHistoryEntry[] = [
      {
        state: '10',
        last_changed: '2025-01-27T08:00:00',
        last_updated: '2025-01-27T08:00:00',
      },
      {
        state: '25',
        last_changed: '2025-01-27T12:00:00',
        last_updated: '2025-01-27T12:00:00',
      },
      {
        state: '15',
        last_changed: '2025-01-27T18:00:00',
        last_updated: '2025-01-27T18:00:00',
      },
    ]

    const result = aggregateHistory(history)

    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2025-01-27')
    expect(result[0].count).toBe(25) // max value
  })

  it('aggregates multiple days', () => {
    const history: HassHistoryEntry[] = [
      {
        state: '10',
        last_changed: '2025-01-27T08:00:00',
        last_updated: '2025-01-27T08:00:00',
      },
      {
        state: '20',
        last_changed: '2025-01-28T08:00:00',
        last_updated: '2025-01-28T08:00:00',
      },
      {
        state: '30',
        last_changed: '2025-01-29T08:00:00',
        last_updated: '2025-01-29T08:00:00',
      },
    ]

    const result = aggregateHistory(history)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ date: '2025-01-27', count: 10 })
    expect(result[1]).toEqual({ date: '2025-01-28', count: 20 })
    expect(result[2]).toEqual({ date: '2025-01-29', count: 30 })
  })

  it('skips non-numeric states', () => {
    const history: HassHistoryEntry[] = [
      {
        state: '10',
        last_changed: '2025-01-27T08:00:00',
        last_updated: '2025-01-27T08:00:00',
      },
      {
        state: 'unavailable',
        last_changed: '2025-01-27T12:00:00',
        last_updated: '2025-01-27T12:00:00',
      },
      {
        state: 'unknown',
        last_changed: '2025-01-27T14:00:00',
        last_updated: '2025-01-27T14:00:00',
      },
      {
        state: '20',
        last_changed: '2025-01-27T18:00:00',
        last_updated: '2025-01-27T18:00:00',
      },
    ]

    const result = aggregateHistory(history)

    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(20) // max of numeric values only
  })

  it('skips entries with missing state or last_changed', () => {
    const history = [
      {
        state: '10',
        last_changed: '2025-01-27T08:00:00',
        last_updated: '2025-01-27T08:00:00',
      },
      {
        state: '',
        last_changed: '2025-01-27T12:00:00',
        last_updated: '2025-01-27T12:00:00',
      },
      { state: '20', last_changed: '', last_updated: '2025-01-27T14:00:00' },
    ] as HassHistoryEntry[]

    const result = aggregateHistory(history)

    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(10)
  })

  it('sorts results by date', () => {
    const history: HassHistoryEntry[] = [
      {
        state: '30',
        last_changed: '2025-01-29T08:00:00',
        last_updated: '2025-01-29T08:00:00',
      },
      {
        state: '10',
        last_changed: '2025-01-27T08:00:00',
        last_updated: '2025-01-27T08:00:00',
      },
      {
        state: '20',
        last_changed: '2025-01-28T08:00:00',
        last_updated: '2025-01-28T08:00:00',
      },
    ]

    const result = aggregateHistory(history)

    expect(result[0].date).toBe('2025-01-27')
    expect(result[1].date).toBe('2025-01-28')
    expect(result[2].date).toBe('2025-01-29')
  })

  it('handles decimal values', () => {
    const history: HassHistoryEntry[] = [
      {
        state: '10.5',
        last_changed: '2025-01-27T08:00:00',
        last_updated: '2025-01-27T08:00:00',
      },
      {
        state: '20.7',
        last_changed: '2025-01-27T12:00:00',
        last_updated: '2025-01-27T12:00:00',
      },
    ]

    const result = aggregateHistory(history)

    expect(result[0].count).toBe(20.7)
  })

  it('handles negative values', () => {
    const history: HassHistoryEntry[] = [
      {
        state: '-5',
        last_changed: '2025-01-27T08:00:00',
        last_updated: '2025-01-27T08:00:00',
      },
      {
        state: '-10',
        last_changed: '2025-01-27T12:00:00',
        last_updated: '2025-01-27T12:00:00',
      },
    ]

    const result = aggregateHistory(history)

    expect(result[0].count).toBe(-5) // max of negative values
  })
})
