import { describe, it, expect } from 'vitest'
import { getDayLabel, generateDayLabels } from './render'

describe('getDayLabel', () => {
  it('returns short weekday names for short mode', () => {
    // Using 'en' locale for predictable results
    expect(getDayLabel(0, 'en', 'short')).toBe('Sun')
    expect(getDayLabel(1, 'en', 'short')).toBe('Mon')
    expect(getDayLabel(2, 'en', 'short')).toBe('Tue')
    expect(getDayLabel(3, 'en', 'short')).toBe('Wed')
    expect(getDayLabel(4, 'en', 'short')).toBe('Thu')
    expect(getDayLabel(5, 'en', 'short')).toBe('Fri')
    expect(getDayLabel(6, 'en', 'short')).toBe('Sat')
  })

  it('returns short weekday names for all mode', () => {
    expect(getDayLabel(0, 'en', 'all')).toBe('Sun')
    expect(getDayLabel(1, 'en', 'all')).toBe('Mon')
  })

  it('returns single letter for letter mode', () => {
    // Note: 'narrow' format returns single letter in most locales
    expect(getDayLabel(0, 'en', 'letter')).toBe('S')
    expect(getDayLabel(1, 'en', 'letter')).toBe('M')
    expect(getDayLabel(2, 'en', 'letter')).toBe('T')
    expect(getDayLabel(3, 'en', 'letter')).toBe('W')
    expect(getDayLabel(4, 'en', 'letter')).toBe('T')
    expect(getDayLabel(5, 'en', 'letter')).toBe('F')
    expect(getDayLabel(6, 'en', 'letter')).toBe('S')
  })

  it('respects locale for short mode', () => {
    // German locale
    expect(getDayLabel(0, 'de', 'short')).toBe('So')
    expect(getDayLabel(1, 'de', 'short')).toBe('Mo')
  })

  it('respects locale for letter mode', () => {
    // German locale
    expect(getDayLabel(0, 'de', 'letter')).toBe('S')
    expect(getDayLabel(1, 'de', 'letter')).toBe('M')
  })
})

describe('generateDayLabels', () => {
  describe('mode: none', () => {
    it('returns empty array', () => {
      expect(generateDayLabels('none', 0, 'en')).toEqual([])
      expect(generateDayLabels('none', 1, 'en')).toEqual([])
    })
  })

  describe('mode: short', () => {
    it('shows 3 alternating labels when week starts Sunday', () => {
      const labels = generateDayLabels('short', 0, 'en')

      expect(labels).toHaveLength(3)
      expect(labels[0]).toEqual({ row: 1, label: 'Mon' })
      expect(labels[1]).toEqual({ row: 3, label: 'Wed' })
      expect(labels[2]).toEqual({ row: 5, label: 'Fri' })
    })

    it('shows 3 alternating labels when week starts Monday', () => {
      const labels = generateDayLabels('short', 1, 'en')

      expect(labels).toHaveLength(3)
      expect(labels[0]).toEqual({ row: 1, label: 'Tue' })
      expect(labels[1]).toEqual({ row: 3, label: 'Thu' })
      expect(labels[2]).toEqual({ row: 5, label: 'Sat' })
    })
  })

  describe('mode: all', () => {
    it('shows all 7 days with short names (Sunday start)', () => {
      const labels = generateDayLabels('all', 0, 'en')

      expect(labels).toHaveLength(7)
      expect(labels[0]).toEqual({ row: 0, label: 'Sun' })
      expect(labels[1]).toEqual({ row: 1, label: 'Mon' })
      expect(labels[2]).toEqual({ row: 2, label: 'Tue' })
      expect(labels[3]).toEqual({ row: 3, label: 'Wed' })
      expect(labels[4]).toEqual({ row: 4, label: 'Thu' })
      expect(labels[5]).toEqual({ row: 5, label: 'Fri' })
      expect(labels[6]).toEqual({ row: 6, label: 'Sat' })
    })

    it('shows all 7 days respecting Monday start order', () => {
      const labels = generateDayLabels('all', 1, 'en')

      expect(labels).toHaveLength(7)
      expect(labels[0]).toEqual({ row: 0, label: 'Mon' })
      expect(labels[1]).toEqual({ row: 1, label: 'Tue' })
      expect(labels[2]).toEqual({ row: 2, label: 'Wed' })
      expect(labels[3]).toEqual({ row: 3, label: 'Thu' })
      expect(labels[4]).toEqual({ row: 4, label: 'Fri' })
      expect(labels[5]).toEqual({ row: 5, label: 'Sat' })
      expect(labels[6]).toEqual({ row: 6, label: 'Sun' })
    })
  })

  describe('mode: letter', () => {
    it('shows all 7 days with single letters (Sunday start)', () => {
      const labels = generateDayLabels('letter', 0, 'en')

      expect(labels).toHaveLength(7)
      expect(labels[0]).toEqual({ row: 0, label: 'S' })
      expect(labels[1]).toEqual({ row: 1, label: 'M' })
      expect(labels[2]).toEqual({ row: 2, label: 'T' })
      expect(labels[3]).toEqual({ row: 3, label: 'W' })
      expect(labels[4]).toEqual({ row: 4, label: 'T' })
      expect(labels[5]).toEqual({ row: 5, label: 'F' })
      expect(labels[6]).toEqual({ row: 6, label: 'S' })
    })

    it('shows all 7 days with single letters (Monday start)', () => {
      const labels = generateDayLabels('letter', 1, 'en')

      expect(labels).toHaveLength(7)
      expect(labels[0]).toEqual({ row: 0, label: 'M' })
      expect(labels[1]).toEqual({ row: 1, label: 'T' })
      expect(labels[2]).toEqual({ row: 2, label: 'W' })
      expect(labels[3]).toEqual({ row: 3, label: 'T' })
      expect(labels[4]).toEqual({ row: 4, label: 'F' })
      expect(labels[5]).toEqual({ row: 5, label: 'S' })
      expect(labels[6]).toEqual({ row: 6, label: 'S' })
    })

    it('respects locale for letter format', () => {
      const labels = generateDayLabels('letter', 1, 'de')

      expect(labels).toHaveLength(7)
      expect(labels[0]).toEqual({ row: 0, label: 'M' })
      expect(labels[6]).toEqual({ row: 6, label: 'S' })
    })
  })
})
