import { describe, it, expect } from 'vitest'
import {
  normalizeData,
  calculateDateRanges,
  getLevel,
  getLevelRange,
  calculateEvenThresholds,
  calculateNeutralLevel,
  boundDataToRange,
  processHeatmapData,
  type PipelineConfig,
  type ContributionData,
  type DateRange,
} from './data-pipeline'

describe('normalizeData', () => {
  const testCases = [
    // Guard clauses
    { name: 'null input', input: null, expected: [] },
    { name: 'undefined input', input: undefined, expected: [] },
    { name: 'empty array', input: [], expected: [] },
    { name: 'non-array string', input: 'not-an-array', expected: [] },
    {
      name: 'non-array object',
      input: { date: '2024-01-01', count: 1 },
      expected: [],
    },
    { name: 'non-array number', input: 42, expected: [] },

    // Format A: array of date strings
    {
      name: 'date strings - counts occurrences',
      input: ['2024-01-15', '2024-01-15', '2024-01-20', '2024-01-15'],
      expected: [
        { date: '2024-01-15', count: 3 },
        { date: '2024-01-20', count: 1 },
      ],
    },
    {
      name: 'date strings - single date',
      input: ['2024-01-15'],
      expected: [{ date: '2024-01-15', count: 1 }],
    },
    {
      name: 'date strings - filters invalid formats',
      input: ['2024-01-15', 'not-a-date', '2024/01/20', '2024-01-20'],
      expected: [
        { date: '2024-01-15', count: 1 },
        { date: '2024-01-20', count: 1 },
      ],
    },
    {
      name: 'date strings - all invalid returns empty',
      input: ['not-a-date', 'also-invalid', '2024/01/20'],
      expected: [],
    },

    // Format B: array of {date, count} objects
    {
      name: 'objects - passes through valid',
      input: [
        { date: '2024-01-15', count: 5 },
        { date: '2024-01-20', count: 2 },
      ],
      expected: [
        { date: '2024-01-15', count: 5 },
        { date: '2024-01-20', count: 2 },
      ],
    },
    {
      name: 'objects - filters missing date',
      input: [{ date: '2024-01-15', count: 5 }, { count: 2 }],
      expected: [{ date: '2024-01-15', count: 5 }],
    },
    {
      name: 'objects - filters missing count',
      input: [{ date: '2024-01-15', count: 5 }, { date: '2024-01-20' }],
      expected: [{ date: '2024-01-15', count: 5 }],
    },
    {
      name: 'objects - filters non-numeric count',
      input: [
        { date: '2024-01-15', count: 5 },
        { date: '2024-01-20', count: 'five' },
      ],
      expected: [{ date: '2024-01-15', count: 5 }],
    },
    {
      name: 'objects - filters invalid date format',
      input: [
        { date: '2024-01-15', count: 5 },
        { date: '2024/01/20', count: 2 },
      ],
      expected: [{ date: '2024-01-15', count: 5 }],
    },
    {
      name: 'objects - all invalid returns empty',
      input: [
        { date: 'invalid', count: 5 },
        { date: '2024-01-20', count: 'five' },
      ],
      expected: [],
    },

    // Format C: datetime strings with timestamps
    {
      name: 'datetime - extracts date and counts',
      input: [
        '2024-01-15T10:30:00',
        '2024-01-15T14:45:00',
        '2024-01-20T09:00:00',
      ],
      expected: [
        { date: '2024-01-15', count: 2 },
        { date: '2024-01-20', count: 1 },
      ],
    },
    {
      name: 'datetime - handles timezone suffixes',
      input: ['2024-01-15T10:30:00Z', '2024-01-15T10:30:00+05:00'],
      expected: [{ date: '2024-01-15', count: 2 }],
    },
    {
      name: 'datetime - mixed date and datetime',
      input: ['2024-01-15', '2024-01-15T14:45:00', '2024-01-20'],
      expected: [
        { date: '2024-01-15', count: 2 },
        { date: '2024-01-20', count: 1 },
      ],
    },

    // Unknown formats
    { name: 'unknown - array of numbers', input: [1, 2, 3], expected: [] },
    { name: 'unknown - array of booleans', input: [true, false], expected: [] },
    {
      name: 'unknown - nested arrays',
      input: [
        [1, 2],
        [3, 4],
      ],
      expected: [],
    },
  ]

  it.each(testCases)('$name', ({ input, expected }) => {
    const result = normalizeData(input)
    expect(result).toEqual(expect.arrayContaining(expected))
    expect(result).toHaveLength(expected.length)
  })
})

describe('calculateDateRanges', () => {
  // Helper to create date at midnight local time
  const date = (y: number, m: number, d: number) => new Date(y, m - 1, d)

  // Helper to format date for readable assertions
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const testCases: Array<{
    name: string
    config: PipelineConfig
    today: Date
    expected: Array<{ start: string; end: string; label?: string }>
  }> = [
    // Rolling mode - Monday start (default)
    // Note: endDate is NOT extended past today to avoid showing empty future day squares
    {
      name: 'rolling, Monday start, today=Sat 2024-06-15',
      config: { mode: 'rolling' },
      today: date(2024, 6, 15), // Saturday
      expected: [{ start: '2023-06-12', end: '2024-06-15' }], // Mon to today (Sat)
    },
    {
      name: 'rolling, Monday start, today=Mon 2024-06-17',
      config: { mode: 'rolling' },
      today: date(2024, 6, 17), // Monday
      expected: [{ start: '2023-06-19', end: '2024-06-17' }], // Mon to today (Mon)
    },
    {
      name: 'rolling, Monday start, today=Sun 2024-06-16',
      config: { mode: 'rolling' },
      today: date(2024, 6, 16), // Sunday
      expected: [{ start: '2023-06-12', end: '2024-06-16' }], // Mon to today (Sun)
    },

    // Rolling mode - Sunday start
    // Note: endDate is NOT extended past today to avoid showing empty future day squares
    {
      name: 'rolling, Sunday start, today=Sat 2024-06-15',
      config: { mode: 'rolling', weekStartDay: 0 },
      today: date(2024, 6, 15), // Saturday
      expected: [{ start: '2023-06-11', end: '2024-06-15' }], // Sun to today (Sat)
    },
    {
      name: 'rolling, Sunday start, today=Sun 2024-06-16',
      config: { mode: 'rolling', weekStartDay: 0 },
      today: date(2024, 6, 16), // Sunday
      expected: [{ start: '2023-06-18', end: '2024-06-16' }], // Sun to today (Sun)
    },

    // Fixed mode - single year (strict Jan 1 - Dec 31, no week adjustment)
    {
      name: 'fixed, 1 year, 2024',
      config: { mode: 'fixed', years: 1 },
      today: date(2024, 6, 15),
      expected: [{ start: '2024-01-01', end: '2024-12-31', label: '2024' }],
    },
    {
      name: 'fixed, 1 year, weekStartDay ignored for range',
      config: { mode: 'fixed', years: 1, weekStartDay: 0 },
      today: date(2024, 6, 15),
      expected: [{ start: '2024-01-01', end: '2024-12-31', label: '2024' }],
    },

    // Fixed mode - multiple years
    {
      name: 'fixed, 2 years, ending 2024',
      config: { mode: 'fixed', years: 2 },
      today: date(2024, 6, 15),
      expected: [
        { start: '2023-01-01', end: '2023-12-31', label: '2023' },
        { start: '2024-01-01', end: '2024-12-31', label: '2024' },
      ],
    },

    // Fixed mode - explicit targetYear
    {
      name: 'fixed, targetYear=2022, 1 year',
      config: { mode: 'fixed', years: 1, targetYear: 2022 },
      today: date(2024, 6, 15),
      expected: [{ start: '2022-01-01', end: '2022-12-31', label: '2022' }],
    },

    // Fixed mode - 3 years
    {
      name: 'fixed, 3 years, ending 2024',
      config: { mode: 'fixed', years: 3 },
      today: date(2024, 6, 15),
      expected: [
        { start: '2022-01-01', end: '2022-12-31', label: '2022' },
        { start: '2023-01-01', end: '2023-12-31', label: '2023' },
        { start: '2024-01-01', end: '2024-12-31', label: '2024' },
      ],
    },

    // Fixed mode - includes future dates when today is mid-year
    {
      name: 'fixed, full year even when today is mid-year',
      config: { mode: 'fixed', years: 1 },
      today: date(2024, 3, 15), // March 15
      expected: [{ start: '2024-01-01', end: '2024-12-31', label: '2024' }],
    },
  ]

  it.each(testCases)('$name', ({ config, today, expected }) => {
    const result = calculateDateRanges(config, today)

    expect(result).toHaveLength(expected.length)

    result.forEach((range, i) => {
      expect(fmt(range.startDate)).toBe(expected[i].start)
      expect(fmt(range.endDate)).toBe(expected[i].end)
      if (expected[i].label) {
        expect(range.label).toBe(expected[i].label)
      }
    })
  })
})

describe('calculateEvenThresholds', () => {
  const testCases: Array<{
    name: string
    levelCount: number
    expected: number[]
  }> = [
    {
      name: 'levelCount=2 returns [50] (1 threshold dividing into 2 levels)',
      levelCount: 2,
      expected: [50],
    },
    {
      name: 'levelCount=3 returns [33.33, 66.66] (2 thresholds dividing into 3 levels)',
      levelCount: 3,
      expected: [100 / 3, 200 / 3],
    },
    {
      name: 'levelCount=5 returns [20, 40, 60, 80] (4 thresholds dividing into 5 levels)',
      levelCount: 5,
      expected: [20, 40, 60, 80],
    },
    {
      name: 'levelCount=10 returns 9 evenly distributed thresholds',
      levelCount: 10,
      expected: [10, 20, 30, 40, 50, 60, 70, 80, 90],
    },
  ]

  it.each(testCases)('$name', ({ levelCount, expected }) => {
    const result = calculateEvenThresholds(levelCount)
    expect(result).toHaveLength(expected.length)
    result.forEach((val, i) => {
      expect(val).toBeCloseTo(expected[i], 5)
    })
  })
})

describe('getLevel', () => {
  describe('with default levelCount=5 (thresholds [20, 40, 60, 80])', () => {
    const testCases: Array<{
      name: string
      count: number
      maxCount: number
      thresholds?: number[]
      expected: number
    }> = [
      // Zero count returns level 0 (0% ≤ 20%)
      { name: 'count=0 returns level 0', count: 0, maxCount: 10, expected: 0 },
      {
        name: 'count=0, maxCount=0 returns level 0',
        count: 0,
        maxCount: 0,
        expected: 0,
      },

      // Edge case: non-zero count with maxCount=0 returns 0 (avoid division issues)
      {
        name: 'count>0, maxCount=0 returns level 0',
        count: 5,
        maxCount: 0,
        expected: 0,
      },

      // Default thresholds [20, 40, 60, 80] with maxCount=100
      { name: '1% → level 0', count: 1, maxCount: 100, expected: 0 },
      {
        name: '20% → level 0 (boundary)',
        count: 20,
        maxCount: 100,
        expected: 0,
      },
      { name: '21% → level 1', count: 21, maxCount: 100, expected: 1 },
      {
        name: '40% → level 1 (boundary)',
        count: 40,
        maxCount: 100,
        expected: 1,
      },
      { name: '41% → level 2', count: 41, maxCount: 100, expected: 2 },
      {
        name: '60% → level 2 (boundary)',
        count: 60,
        maxCount: 100,
        expected: 2,
      },
      { name: '61% → level 3', count: 61, maxCount: 100, expected: 3 },
      {
        name: '80% → level 3 (boundary)',
        count: 80,
        maxCount: 100,
        expected: 3,
      },
      { name: '81% → level 4', count: 81, maxCount: 100, expected: 4 },
      { name: '100% → level 4', count: 100, maxCount: 100, expected: 4 },

      // Default thresholds with maxCount=10 for clear percentages
      {
        name: 'count=1/10 (10%) → level 0',
        count: 1,
        maxCount: 10,
        expected: 0,
      },
      {
        name: 'count=2/10 (20%) → level 0',
        count: 2,
        maxCount: 10,
        expected: 0,
      },
      {
        name: 'count=3/10 (30%) → level 1',
        count: 3,
        maxCount: 10,
        expected: 1,
      },
      {
        name: 'count=5/10 (50%) → level 2',
        count: 5,
        maxCount: 10,
        expected: 2,
      },
      {
        name: 'count=7/10 (70%) → level 3',
        count: 7,
        maxCount: 10,
        expected: 3,
      },
      {
        name: 'count=9/10 (90%) → level 4',
        count: 9,
        maxCount: 10,
        expected: 4,
      },
      {
        name: 'count=10/10 (100%) → level 4',
        count: 10,
        maxCount: 10,
        expected: 4,
      },

      // Custom thresholds [60, 80, 90, 95] - emphasize high values
      {
        name: 'custom [60,80,90,95]: 50% → level 0',
        count: 50,
        maxCount: 100,
        thresholds: [60, 80, 90, 95],
        expected: 0,
      },
      {
        name: 'custom [60,80,90,95]: 70% → level 1',
        count: 70,
        maxCount: 100,
        thresholds: [60, 80, 90, 95],
        expected: 1,
      },
      {
        name: 'custom [60,80,90,95]: 85% → level 2',
        count: 85,
        maxCount: 100,
        thresholds: [60, 80, 90, 95],
        expected: 2,
      },
      {
        name: 'custom [60,80,90,95]: 92% → level 3',
        count: 92,
        maxCount: 100,
        thresholds: [60, 80, 90, 95],
        expected: 3,
      },
      {
        name: 'custom [60,80,90,95]: 98% → level 4',
        count: 98,
        maxCount: 100,
        thresholds: [60, 80, 90, 95],
        expected: 4,
      },

      // Custom thresholds [5, 15, 30, 50] - emphasize any activity
      {
        name: 'custom [5,15,30,50]: 3% → level 0',
        count: 3,
        maxCount: 100,
        thresholds: [5, 15, 30, 50],
        expected: 0,
      },
      {
        name: 'custom [5,15,30,50]: 10% → level 1',
        count: 10,
        maxCount: 100,
        thresholds: [5, 15, 30, 50],
        expected: 1,
      },
      {
        name: 'custom [5,15,30,50]: 25% → level 2',
        count: 25,
        maxCount: 100,
        thresholds: [5, 15, 30, 50],
        expected: 2,
      },
      {
        name: 'custom [5,15,30,50]: 40% → level 3',
        count: 40,
        maxCount: 100,
        thresholds: [5, 15, 30, 50],
        expected: 3,
      },
      {
        name: 'custom [5,15,30,50]: 60% → level 4',
        count: 60,
        maxCount: 100,
        thresholds: [5, 15, 30, 50],
        expected: 4,
      },
    ]

    it.each(testCases)('$name', ({ count, maxCount, thresholds, expected }) => {
      const result = thresholds
        ? getLevel(count, maxCount, 5, thresholds)
        : getLevel(count, maxCount)
      expect(result).toBe(expected)
    })
  })

  describe('with levelCount=2 (thresholds [50])', () => {
    it('0-50% returns level 0', () => {
      expect(getLevel(0, 10, 2)).toBe(0)
      expect(getLevel(5, 10, 2)).toBe(0) // 50%
    })

    it('51-100% returns level 1', () => {
      expect(getLevel(6, 10, 2)).toBe(1) // 60%
      expect(getLevel(10, 10, 2)).toBe(1) // 100%
    })
  })

  describe('with levelCount=3 (thresholds [33.33, 66.66])', () => {
    it('0-33% returns level 0', () => {
      expect(getLevel(0, 100, 3)).toBe(0)
      expect(getLevel(33, 100, 3)).toBe(0)
    })

    it('34-66% returns level 1', () => {
      expect(getLevel(34, 100, 3)).toBe(1)
      expect(getLevel(66, 100, 3)).toBe(1)
    })

    it('67-100% returns level 2', () => {
      expect(getLevel(67, 100, 3)).toBe(2)
      expect(getLevel(100, 100, 3)).toBe(2)
    })
  })

  describe('with levelCount=10 (thresholds [10, 20, 30, 40, 50, 60, 70, 80, 90])', () => {
    it('count=0 returns level 0', () => {
      expect(getLevel(0, 100, 10)).toBe(0)
    })

    it('distributes levels 0-9 across percentages', () => {
      // With thresholds at 10, 20, 30, 40, 50, 60, 70, 80, 90
      expect(getLevel(5, 100, 10)).toBe(0) // 5% ≤ 10%
      expect(getLevel(10, 100, 10)).toBe(0) // 10% ≤ 10%
      expect(getLevel(15, 100, 10)).toBe(1) // 15% ≤ 20%
      expect(getLevel(25, 100, 10)).toBe(2) // 25% ≤ 30%
      expect(getLevel(35, 100, 10)).toBe(3) // 35% ≤ 40%
      expect(getLevel(45, 100, 10)).toBe(4) // 45% ≤ 50%
      expect(getLevel(55, 100, 10)).toBe(5) // 55% ≤ 60%
      expect(getLevel(65, 100, 10)).toBe(6) // 65% ≤ 70%
      expect(getLevel(75, 100, 10)).toBe(7) // 75% ≤ 80%
      expect(getLevel(85, 100, 10)).toBe(8) // 85% ≤ 90%
      expect(getLevel(95, 100, 10)).toBe(9) // 95% > 90%
      expect(getLevel(100, 100, 10)).toBe(9) // 100% → highest level
    })
  })

  describe('with custom thresholds for various level counts', () => {
    it('levelCount=3 with custom thresholds [30, 70]', () => {
      expect(getLevel(0, 100, 3, [30, 70])).toBe(0)
      expect(getLevel(20, 100, 3, [30, 70])).toBe(0)
      expect(getLevel(30, 100, 3, [30, 70])).toBe(0)
      expect(getLevel(50, 100, 3, [30, 70])).toBe(1)
      expect(getLevel(80, 100, 3, [30, 70])).toBe(2)
    })

    it('levelCount=10 with custom thresholds', () => {
      const customThresholds = [5, 15, 25, 35, 45, 55, 65, 75, 85]
      expect(getLevel(3, 100, 10, customThresholds)).toBe(0) // 3% ≤ 5%
      expect(getLevel(10, 100, 10, customThresholds)).toBe(1) // 10% ≤ 15%
      expect(getLevel(90, 100, 10, customThresholds)).toBe(9) // 90% > 85%
    })
  })

  describe('negative values (clamp_zero behavior)', () => {
    it('negative count returns level 0 (clamped to 0%)', () => {
      expect(getLevel(-5, 100)).toBe(0)
    })

    it('negative count with various maxCount values returns level 0', () => {
      expect(getLevel(-1, 10)).toBe(0)
      expect(getLevel(-50, 100)).toBe(0)
      expect(getLevel(-100, 100)).toBe(0)
    })

    it('negative count with maxCount=0 returns level 0', () => {
      expect(getLevel(-5, 0)).toBe(0)
    })
  })

  describe('with explicit maxValue', () => {
    it('uses maxValue instead of maxCount for percentage calculation', () => {
      // maxValue=10, so 5 is 50% regardless of actual maxCount=100
      expect(getLevel(5, 100, 5, undefined, 10)).toBe(2) // 50% → level 2
    })

    it('values at maxValue get highest level', () => {
      // maxValue=10, count=10 is 100%
      expect(getLevel(10, 100, 5, undefined, 10)).toBe(4) // 100% → level 4
    })

    it('values exceeding maxValue cap at highest level', () => {
      // maxValue=10, count=30 exceeds it, should cap at level 4
      expect(getLevel(30, 100, 5, undefined, 10)).toBe(4)
      expect(getLevel(100, 100, 5, undefined, 10)).toBe(4)
      expect(getLevel(1000, 100, 5, undefined, 10)).toBe(4)
    })

    it('works with custom thresholds', () => {
      // maxValue=100, thresholds [10, 30, 60, 90]
      const thresholds = [10, 30, 60, 90]
      expect(getLevel(5, 1000, 5, thresholds, 100)).toBe(0) // 5% ≤ 10%
      expect(getLevel(20, 1000, 5, thresholds, 100)).toBe(1) // 20% ≤ 30%
      expect(getLevel(50, 1000, 5, thresholds, 100)).toBe(2) // 50% ≤ 60%
      expect(getLevel(80, 1000, 5, thresholds, 100)).toBe(3) // 80% ≤ 90%
      expect(getLevel(95, 1000, 5, thresholds, 100)).toBe(4) // 95% > 90%
    })

    it('falls back to maxCount when maxValue is undefined', () => {
      expect(getLevel(50, 100, 5, undefined, undefined)).toBe(2) // 50% → level 2
      expect(getLevel(50, 100)).toBe(2) // same without explicit undefined
    })
  })
})

describe('getLevelRange', () => {
  describe('with default levelCount=5 (thresholds [20, 40, 60, 80])', () => {
    it('distributes levels across min..max range', () => {
      // Range from -10 to 10, so 0 is at 50%
      expect(getLevelRange(-10, -10, 10)).toBe(0) // 0% ≤ 20%
      expect(getLevelRange(-5, -10, 10)).toBe(1) // 25% ≤ 40%
      expect(getLevelRange(0, -10, 10)).toBe(2) // 50% ≤ 60%
      expect(getLevelRange(5, -10, 10)).toBe(3) // 75% ≤ 80%
      expect(getLevelRange(10, -10, 10)).toBe(4) // 100% > 80%
    })

    it('handles all same values (edge case)', () => {
      expect(getLevelRange(5, 5, 5)).toBe(2) // middle level
    })
  })

  describe('with custom thresholds', () => {
    it('uses custom thresholds correctly', () => {
      const thresholds = [10, 30, 60, 90]
      // Range from 0 to 100
      expect(getLevelRange(5, 0, 100, 5, thresholds)).toBe(0) // 5% ≤ 10%
      expect(getLevelRange(20, 0, 100, 5, thresholds)).toBe(1) // 20% ≤ 30%
      expect(getLevelRange(50, 0, 100, 5, thresholds)).toBe(2) // 50% ≤ 60%
      expect(getLevelRange(80, 0, 100, 5, thresholds)).toBe(3) // 80% ≤ 90%
      expect(getLevelRange(95, 0, 100, 5, thresholds)).toBe(4) // 95% > 90%
    })
  })

  describe('unified model verification', () => {
    it('getLevel and getLevelRange produce same results for equivalent inputs', () => {
      // When min=0, getLevelRange should behave identically to getLevel
      const thresholds = [20, 40, 60, 80]
      const testValues = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

      for (const val of testValues) {
        const levelFromGetLevel = getLevel(val, 100, 5, thresholds)
        const levelFromGetLevelRange = getLevelRange(val, 0, 100, 5, thresholds)
        expect(
          levelFromGetLevelRange,
          `value ${val}: getLevel=${levelFromGetLevel}, getLevelRange=${levelFromGetLevelRange}`,
        ).toBe(levelFromGetLevel)
      }
    })
  })

  describe('with explicit maxValue', () => {
    it('uses maxValue instead of maxCount for percentage calculation', () => {
      // Range [-10, 100] but maxValue=10, so 5 is at 75% of [-10, 10]
      expect(getLevelRange(5, -10, 100, 5, undefined, 10)).toBe(3) // 75% → level 3
    })

    it('values at maxValue get highest level', () => {
      // maxValue=10 with range [-10, 100], count=10 is 100% of [-10, 10]
      expect(getLevelRange(10, -10, 100, 5, undefined, 10)).toBe(4) // 100% → level 4
    })

    it('values exceeding maxValue cap at highest level', () => {
      // maxValue=10, count=50 exceeds it, should cap at level 4
      expect(getLevelRange(50, -10, 100, 5, undefined, 10)).toBe(4)
      expect(getLevelRange(100, -10, 100, 5, undefined, 10)).toBe(4)
    })

    it('values below minValue cap at lowest level', () => {
      // minValue=0, maxValue=10, count=-5 is below, should cap at level 0
      expect(getLevelRange(-5, -10, 100, 5, undefined, 10, 0)).toBe(0)
    })
  })
})

describe('boundDataToRange', () => {
  // Helper to create a date range
  const range = (start: string, end: string, label?: string): DateRange => ({
    startDate: new Date(start),
    endDate: new Date(end),
    label,
  })

  // Helper to flatten weeks into a single array of days
  const flattenDays = (
    weeks: { date: string; count: number; level: number }[][],
  ) => weeks.flat()

  const testCases: Array<{
    name: string
    data: ContributionData[]
    range: DateRange
    levelCount?: number
    thresholds?: number[]
    expectMaxCount: number
    expectWeekCount: number
    expectDayCount: number
    expectSampleDays?: Array<{ date: string; count: number; level: number }>
  }> = [
    // Empty data - all zeros
    {
      name: 'empty data fills range with zeros',
      data: [],
      range: range('2024-01-01', '2024-01-07'), // 7 days = 1 week
      expectMaxCount: 0,
      expectWeekCount: 1,
      expectDayCount: 7,
      expectSampleDays: [
        { date: '2024-01-01', count: 0, level: 0 },
        { date: '2024-01-07', count: 0, level: 0 },
      ],
    },

    // Data within range
    {
      name: 'data within range appears with correct counts',
      data: [
        { date: '2024-01-03', count: 5 },
        { date: '2024-01-05', count: 10 },
      ],
      range: range('2024-01-01', '2024-01-07'),
      expectMaxCount: 10,
      expectWeekCount: 1,
      expectDayCount: 7,
      expectSampleDays: [
        { date: '2024-01-01', count: 0, level: 0 },
        { date: '2024-01-03', count: 5, level: 2 }, // 50% → level 2 (40-60%)
        { date: '2024-01-05', count: 10, level: 4 }, // 100% → level 4 (>80%)
        { date: '2024-01-07', count: 0, level: 0 },
      ],
    },

    // Overflow - data outside range is ignored
    {
      name: 'data outside range (overflow) is ignored',
      data: [
        { date: '2023-12-31', count: 100 }, // before range
        { date: '2024-01-03', count: 5 },
        { date: '2024-01-08', count: 100 }, // after range
      ],
      range: range('2024-01-01', '2024-01-07'),
      expectMaxCount: 5, // overflow data not counted
      expectWeekCount: 1,
      expectDayCount: 7,
      expectSampleDays: [
        { date: '2024-01-03', count: 5, level: 4 }, // 100% → level 4 (>80%)
      ],
    },

    // Underflow - missing dates filled with 0
    {
      name: 'missing dates (underflow) filled with zeros',
      data: [{ date: '2024-01-15', count: 8 }], // only one date in range
      range: range('2024-01-01', '2024-01-31'), // 31 days
      expectMaxCount: 8,
      expectWeekCount: 5, // ceil(31/7)
      expectDayCount: 31,
      expectSampleDays: [
        { date: '2024-01-01', count: 0, level: 0 },
        { date: '2024-01-15', count: 8, level: 4 }, // 100% → level 4
        { date: '2024-01-31', count: 0, level: 0 },
      ],
    },

    // Partial week at end
    {
      name: 'partial week at end is included',
      data: [],
      range: range('2024-01-01', '2024-01-10'), // 10 days = 1 full week + 3 days
      expectMaxCount: 0,
      expectWeekCount: 2,
      expectDayCount: 10,
    },

    // Full year
    {
      name: 'full year 2024 (leap year = 366 days)',
      data: [{ date: '2024-06-15', count: 10 }],
      range: range('2024-01-01', '2024-12-31'),
      expectMaxCount: 10,
      expectWeekCount: 53, // ceil(366/7) = 53
      expectDayCount: 366,
    },

    // Custom thresholds with default levelCount=5 (needs 4 thresholds)
    {
      name: 'custom thresholds affect levels',
      data: [
        { date: '2024-01-02', count: 10 },
        { date: '2024-01-03', count: 50 },
        { date: '2024-01-04', count: 80 },
        { date: '2024-01-05', count: 100 },
      ],
      range: range('2024-01-01', '2024-01-07'),
      thresholds: [10, 50, 80, 95], // 4 thresholds for 5 levels
      expectMaxCount: 100,
      expectWeekCount: 1,
      expectDayCount: 7,
      expectSampleDays: [
        { date: '2024-01-02', count: 10, level: 0 }, // 10% ≤ 10% → level 0
        { date: '2024-01-03', count: 50, level: 1 }, // 50% ≤ 50% → level 1
        { date: '2024-01-04', count: 80, level: 2 }, // 80% ≤ 80% → level 2
        { date: '2024-01-05', count: 100, level: 4 }, // 100% > 95% → level 4
      ],
    },

    // levelCount=2 (threshold at 50%)
    {
      name: 'levelCount=2 produces binary levels at 50% threshold',
      data: [
        { date: '2024-01-02', count: 40 },
        { date: '2024-01-03', count: 50 },
        { date: '2024-01-04', count: 60 },
        { date: '2024-01-05', count: 100 },
      ],
      range: range('2024-01-01', '2024-01-07'),
      levelCount: 2,
      expectMaxCount: 100,
      expectWeekCount: 1,
      expectDayCount: 7,
      expectSampleDays: [
        { date: '2024-01-01', count: 0, level: 0 }, // 0% ≤ 50%
        { date: '2024-01-02', count: 40, level: 0 }, // 40% ≤ 50%
        { date: '2024-01-03', count: 50, level: 0 }, // 50% ≤ 50%
        { date: '2024-01-04', count: 60, level: 1 }, // 60% > 50%
        { date: '2024-01-05', count: 100, level: 1 }, // 100% > 50%
      ],
    },

    // levelCount=10 with auto thresholds [10, 20, 30, 40, 50, 60, 70, 80, 90]
    {
      name: 'levelCount=10 distributes across 10 levels',
      data: [
        { date: '2024-01-02', count: 10 },
        { date: '2024-01-03', count: 50 },
        { date: '2024-01-04', count: 90 },
        { date: '2024-01-05', count: 100 },
      ],
      range: range('2024-01-01', '2024-01-07'),
      levelCount: 10,
      expectMaxCount: 100,
      expectWeekCount: 1,
      expectDayCount: 7,
      expectSampleDays: [
        { date: '2024-01-01', count: 0, level: 0 },
        { date: '2024-01-02', count: 10, level: 0 }, // 10% ≤ 10%
        { date: '2024-01-03', count: 50, level: 4 }, // 50% ≤ 50%
        { date: '2024-01-04', count: 90, level: 8 }, // 90% ≤ 90%
        { date: '2024-01-05', count: 100, level: 9 }, // 100% > 90% → highest
      ],
    },
  ]

  it.each(testCases)(
    '$name',
    ({
      data,
      range: r,
      levelCount,
      thresholds,
      expectMaxCount,
      expectWeekCount,
      expectDayCount,
      expectSampleDays,
    }) => {
      const result = boundDataToRange(data, r, levelCount, thresholds)

      expect(result.maxCount).toBe(expectMaxCount)
      expect(result.weeks.length).toBe(expectWeekCount)

      const allDays = flattenDays(result.weeks)
      expect(allDays.length).toBe(expectDayCount)

      if (expectSampleDays) {
        for (const expected of expectSampleDays) {
          const found = allDays.find((d) => d.date === expected.date)
          expect(found).toBeDefined()
          expect(found?.count).toBe(expected.count)
          expect(found?.level).toBe(expected.level)
        }
      }
    },
  )
})

describe('processHeatmapData', () => {
  // Helper to create date at midnight local time
  const date = (y: number, m: number, d: number) => new Date(y, m - 1, d)

  const testCases: Array<{
    name: string
    config: PipelineConfig
    rawData: unknown
    today: Date
    expectRangeCount: number
    expectLabels?: string[]
  }> = [
    // Rolling mode returns single HeatmapData
    {
      name: 'rolling mode returns single result',
      config: { mode: 'rolling' },
      rawData: ['2024-06-01', '2024-06-01', '2024-06-15'],
      today: date(2024, 6, 20),
      expectRangeCount: 1,
    },

    // Fixed mode single year
    {
      name: 'fixed mode single year returns one result',
      config: { mode: 'fixed', years: 1 },
      rawData: [{ date: '2024-03-15', count: 5 }],
      today: date(2024, 6, 20),
      expectRangeCount: 1,
      expectLabels: ['2024'],
    },

    // Fixed mode multiple years
    {
      name: 'fixed mode 2 years returns two results',
      config: { mode: 'fixed', years: 2 },
      rawData: [],
      today: date(2024, 6, 20),
      expectRangeCount: 2,
      expectLabels: ['2023', '2024'],
    },

    // Fixed mode 3 years
    {
      name: 'fixed mode 3 years returns three results',
      config: { mode: 'fixed', years: 3 },
      rawData: [],
      today: date(2024, 6, 20),
      expectRangeCount: 3,
      expectLabels: ['2022', '2023', '2024'],
    },

    // Handles string array input (normalizes)
    {
      name: 'normalizes string array input',
      config: { mode: 'fixed', years: 1 },
      rawData: ['2024-01-15', '2024-01-15', '2024-01-20'],
      today: date(2024, 6, 20),
      expectRangeCount: 1,
    },

    // Handles object array input (normalizes)
    {
      name: 'normalizes object array input',
      config: { mode: 'fixed', years: 1 },
      rawData: [
        { date: '2024-01-15', count: 3 },
        { date: '2024-01-20', count: 1 },
      ],
      today: date(2024, 6, 20),
      expectRangeCount: 1,
    },

    // Handles null/invalid input gracefully
    {
      name: 'handles null input gracefully',
      config: { mode: 'rolling' },
      rawData: null,
      today: date(2024, 6, 20),
      expectRangeCount: 1,
    },
  ]

  it.each(testCases)(
    '$name',
    ({ config, rawData, today, expectRangeCount, expectLabels }) => {
      const result = processHeatmapData(config, rawData, today)

      expect(result).toHaveLength(expectRangeCount)

      if (expectLabels) {
        const labels = result.map((r) => r.range.label)
        expect(labels).toEqual(expectLabels)
      }

      // Each result should have valid structure
      for (const heatmap of result) {
        expect(heatmap.range).toBeDefined()
        expect(heatmap.range.startDate).toBeInstanceOf(Date)
        expect(heatmap.range.endDate).toBeInstanceOf(Date)
        expect(heatmap.weeks).toBeInstanceOf(Array)
        expect(heatmap.weeks.length).toBeGreaterThan(0)
        expect(typeof heatmap.maxCount).toBe('number')
      }
    },
  )

  it('passes custom thresholds through to level calculation', () => {
    const config: PipelineConfig = {
      mode: 'fixed',
      years: 1,
      levelThresholds: [10, 20, 30, 50], // 4 thresholds for 5 levels
    }
    const rawData = [
      { date: '2024-01-15', count: 100 }, // max
      { date: '2024-01-16', count: 25 }, // 25% of max
    ]
    const result = processHeatmapData(config, rawData, date(2024, 6, 20))

    const allDays = result[0].weeks.flat()
    const day16 = allDays.find((d) => d.date === '2024-01-16')

    // With thresholds [10, 20, 30, 50], 25% should be level 2 (> 20%, ≤ 30%)
    expect(day16?.level).toBe(2)
  })

  describe('configurable levelCount', () => {
    it('defaults to 5 levels (0-4) when levelCount not specified', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1 }
      // With thresholds [20, 40, 60, 80]:
      // 0-20% → level 0, 21-40% → level 1, 41-60% → level 2, 61-80% → level 3, 81-100% → level 4
      const rawData = [
        { date: '2024-01-15', count: 100 }, // 100% → level 4
        { date: '2024-01-16', count: 85 }, // 85% → level 4
        { date: '2024-01-17', count: 65 }, // 65% → level 3
        { date: '2024-01-18', count: 45 }, // 45% → level 2
        { date: '2024-01-19', count: 25 }, // 25% → level 1
        { date: '2024-01-20', count: 15 }, // 15% → level 0
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(4)
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(4)
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(3)
      expect(allDays.find((d) => d.date === '2024-01-18')?.level).toBe(2)
      expect(allDays.find((d) => d.date === '2024-01-19')?.level).toBe(1)
      expect(allDays.find((d) => d.date === '2024-01-20')?.level).toBe(0)
    })

    it('supports levelCount=2 (threshold at 50%)', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1, levelCount: 2 }
      const rawData = [
        { date: '2024-01-15', count: 100 }, // 100% → level 1
        { date: '2024-01-16', count: 60 }, // 60% → level 1
        { date: '2024-01-17', count: 40 }, // 40% → level 0
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-01')?.level).toBe(0) // no activity
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(1) // > 50%
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(1) // > 50%
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(0) // ≤ 50%
    })

    it('supports levelCount=10', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1, levelCount: 10 }
      // With thresholds [10, 20, 30, 40, 50, 60, 70, 80, 90]
      const rawData = [
        { date: '2024-01-15', count: 100 }, // 100% → level 9
        { date: '2024-01-16', count: 50 }, // 50% ≤ 50% → level 4
        { date: '2024-01-17', count: 10 }, // 10% ≤ 10% → level 0
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(9) // highest
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(4) // 50% ≤ 50%
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(0) // 10% ≤ 10%
    })

    it('clamps levelCount below 2 to 2', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1, levelCount: 0 }
      const rawData = [{ date: '2024-01-15', count: 100 }]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      // With levelCount=2 (threshold at 50%), 100% should be level 1
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(1)
    })

    it('clamps levelCount above 10 to 10', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        levelCount: 100,
      }
      const rawData = [{ date: '2024-01-15', count: 100 }]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      // With levelCount=10, max should be level 9
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(9)
    })

    it('uses custom thresholds with custom levelCount', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        levelCount: 3,
        levelThresholds: [30, 70], // 2 thresholds for 3 levels
      }
      const rawData = [
        { date: '2024-01-15', count: 100 }, // 100% > 70% → level 2
        { date: '2024-01-16', count: 25 }, // 25% ≤ 30% → level 0
        { date: '2024-01-17', count: 50 }, // 50% ≤ 70% → level 1
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(2)
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(0)
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(1)
    })
  })

  describe('value_mode: clamp_zero (default)', () => {
    it('negative values are treated as level 0 by default', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1 }
      // With thresholds [20, 40, 60, 80]
      const rawData = [
        { date: '2024-01-15', count: 100 }, // max → level 4
        { date: '2024-01-16', count: -50 }, // negative → clamped to 0% → level 0
        { date: '2024-01-17', count: -5 }, // negative → clamped to 0% → level 0
        { date: '2024-01-18', count: 0 }, // 0% → level 0
        { date: '2024-01-19', count: 25 }, // 25% → level 1
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(4) // max
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(0) // negative → 0
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(0) // negative → 0
      expect(allDays.find((d) => d.date === '2024-01-18')?.level).toBe(0) // zero → 0
      expect(allDays.find((d) => d.date === '2024-01-19')?.level).toBe(1) // 25% > 20%
    })

    it('explicit value_mode: clamp_zero treats negatives as level 0', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        valueMode: 'clamp_zero',
      }
      const rawData = [
        { date: '2024-01-15', count: 100 },
        { date: '2024-01-16', count: -25 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(0)
    })

    it('negative values do not affect maxCount calculation', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1 }
      const rawData = [
        { date: '2024-01-15', count: -1000 }, // large negative should not affect max
        { date: '2024-01-16', count: 10 }, // this should be the max
        { date: '2024-01-17', count: 5 }, // 50% of max → level 2
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      expect(result[0].maxCount).toBe(10) // maxCount ignores negatives
      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(2) // 50% → level 2
    })
  })

  describe('missingMode: transparent', () => {
    it('default missingMode does not set missing flag', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1 }
      const rawData = [{ date: '2024-01-15', count: 5 }]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      // With default mode, missing flag should be undefined
      const missingDay = allDays.find((d) => d.date === '2024-01-10')
      expect(missingDay?.missing).toBeUndefined()
    })

    it('missingMode: transparent marks days without data as missing', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        missingMode: 'transparent',
      }
      const rawData = [
        { date: '2024-01-15', count: 5 },
        { date: '2024-01-16', count: 0 }, // explicit zero, NOT missing
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()

      // Day with data (count > 0) - not missing
      const dayWithData = allDays.find((d) => d.date === '2024-01-15')
      expect(dayWithData?.missing).toBe(false)
      expect(dayWithData?.count).toBe(5)

      // Day with explicit zero - not missing
      const dayWithZero = allDays.find((d) => d.date === '2024-01-16')
      expect(dayWithZero?.missing).toBe(false)
      expect(dayWithZero?.count).toBe(0)

      // Day without any data - missing
      const missingDay = allDays.find((d) => d.date === '2024-01-10')
      expect(missingDay?.missing).toBe(true)
      expect(missingDay?.count).toBe(0)
      expect(missingDay?.level).toBe(0)
    })

    it('missingMode: zero (explicit) does not set missing flag', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        missingMode: 'zero',
      }
      const rawData = [{ date: '2024-01-15', count: 5 }]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      const missingDay = allDays.find((d) => d.date === '2024-01-10')
      expect(missingDay?.missing).toBeUndefined()
    })
  })

  describe('valueMode: range', () => {
    it('distributes levels across min..max including negatives', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        valueMode: 'range',
      }
      // Data from -10 to +10, so 0 is in the middle
      const rawData = [
        { date: '2024-01-10', count: -10 }, // min → level 0
        { date: '2024-01-11', count: -5 }, // 25% → level 1
        { date: '2024-01-12', count: 0 }, // 50% → level 2
        { date: '2024-01-13', count: 5 }, // 75% → level 3
        { date: '2024-01-14', count: 10 }, // max → level 4
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-10')?.level).toBe(0) // min
      expect(allDays.find((d) => d.date === '2024-01-11')?.level).toBe(1) // 25%
      expect(allDays.find((d) => d.date === '2024-01-12')?.level).toBe(2) // 50% (zero)
      expect(allDays.find((d) => d.date === '2024-01-13')?.level).toBe(3) // 75%
      expect(allDays.find((d) => d.date === '2024-01-14')?.level).toBe(4) // max
    })

    it('forces missingMode to transparent (zero has meaning in range)', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        valueMode: 'range',
        missingMode: 'zero', // should be ignored, forced to transparent
      }
      const rawData = [
        { date: '2024-01-15', count: 10 },
        { date: '2024-01-16', count: -10 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      // Missing days should have missing: true (transparent forced)
      const missingDay = allDays.find((d) => d.date === '2024-01-10')
      expect(missingDay?.missing).toBe(true)
    })

    it('handles all positive values (min > 0)', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        valueMode: 'range',
      }
      // All positive: 5 to 15
      const rawData = [
        { date: '2024-01-10', count: 5 }, // min → level 0
        { date: '2024-01-11', count: 10 }, // 50% → level 2
        { date: '2024-01-12', count: 15 }, // max → level 4
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-10')?.level).toBe(0) // min
      expect(allDays.find((d) => d.date === '2024-01-11')?.level).toBe(2) // 50%
      expect(allDays.find((d) => d.date === '2024-01-12')?.level).toBe(4) // max
    })

    it('handles all negative values (max < 0)', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        valueMode: 'range',
      }
      // All negative: -15 to -5
      const rawData = [
        { date: '2024-01-10', count: -15 }, // min → level 0
        { date: '2024-01-11', count: -10 }, // 50% → level 2
        { date: '2024-01-12', count: -5 }, // max → level 4
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-10')?.level).toBe(0) // min
      expect(allDays.find((d) => d.date === '2024-01-11')?.level).toBe(2) // 50%
      expect(allDays.find((d) => d.date === '2024-01-12')?.level).toBe(4) // max
    })

    it('tracks minCount in HeatmapData', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        valueMode: 'range',
      }
      const rawData = [
        { date: '2024-01-10', count: -20 },
        { date: '2024-01-11', count: 30 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      expect(result[0].minCount).toBe(-20)
      expect(result[0].maxCount).toBe(30)
    })
  })

  describe('maxValue configuration', () => {
    it('uses maxValue as 100% ceiling instead of dynamic max', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        maxValue: 10000, // 10k steps = 100%
      }
      // With thresholds [20, 40, 60, 80]:
      // 10000 steps = 100% → level 4
      // 5000 steps = 50% → level 2
      // 30000 steps > 10000 → capped at 100% → level 4
      const rawData = [
        { date: '2024-01-15', count: 30000 }, // actual max but exceeds maxValue
        { date: '2024-01-16', count: 10000 }, // at maxValue → 100%
        { date: '2024-01-17', count: 5000 }, // 50%
        { date: '2024-01-18', count: 2000 }, // 20%
        { date: '2024-01-19', count: 1000 }, // 10%
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(4) // >100% capped
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(4) // 100%
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(2) // 50%
      expect(allDays.find((d) => d.date === '2024-01-18')?.level).toBe(0) // 20%
      expect(allDays.find((d) => d.date === '2024-01-19')?.level).toBe(0) // 10%
    })

    it('preserves dynamic behavior when maxValue is not set', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1 }
      // Without maxValue, 30000 is the max (100%)
      const rawData = [
        { date: '2024-01-15', count: 30000 }, // 100% → level 4
        { date: '2024-01-16', count: 10000 }, // 33% → level 1
        { date: '2024-01-17', count: 5000 }, // 17% → level 0
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(4) // 100%
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(1) // ~33%
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(0) // ~17%
    })

    it('works with custom levelThresholds', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        maxValue: 100,
        levelThresholds: [25, 50, 75, 90], // 4 thresholds for 5 levels
      }
      const rawData = [
        { date: '2024-01-15', count: 150 }, // 150% capped → level 4
        { date: '2024-01-16', count: 100 }, // 100% > 90% → level 4
        { date: '2024-01-17', count: 80 }, // 80% > 75% → level 3
        { date: '2024-01-18', count: 60 }, // 60% > 50% → level 2
        { date: '2024-01-19', count: 30 }, // 30% > 25% → level 1
        { date: '2024-01-20', count: 20 }, // 20% ≤ 25% → level 0
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(4)
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(4)
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(3)
      expect(allDays.find((d) => d.date === '2024-01-18')?.level).toBe(2)
      expect(allDays.find((d) => d.date === '2024-01-19')?.level).toBe(1)
      expect(allDays.find((d) => d.date === '2024-01-20')?.level).toBe(0)
    })

    it('maxCount still reflects actual data max for tooltip display', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        maxValue: 10000,
      }
      const rawData = [
        { date: '2024-01-15', count: 30000 }, // exceeds maxValue
        { date: '2024-01-16', count: 5000 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      // maxCount should still be the actual max for display purposes
      expect(result[0].maxCount).toBe(30000)
    })
  })

  describe('diverging mode (isDiverging: true)', () => {
    it('calculates neutralLevel for symmetric data around zero', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        isDiverging: true,
      }
      const rawData = [
        { date: '2024-01-10', count: -10 },
        { date: '2024-01-11', count: 0 },
        { date: '2024-01-12', count: 10 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      // Zero should be at the center level (level 2 for levelCount 5)
      expect(result[0].neutralLevel).toBe(2)
      expect(result[0].minCount).toBe(-10)
      expect(result[0].maxCount).toBe(10)
    })

    it('calculates neutralLevel for asymmetric data', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        isDiverging: true,
      }
      // Asymmetric: -5 to +15, so 0 is at 25% → level 1
      const rawData = [
        { date: '2024-01-10', count: -5 },
        { date: '2024-01-11', count: 15 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      // 0 is at 25% of range [-5, 15], so level = round(0.25 * 4) = 1
      expect(result[0].neutralLevel).toBe(1)
    })

    it('uses explicit neutralValue when provided', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        isDiverging: true,
        neutralValue: 5, // Custom neutral at 5
      }
      const rawData = [
        { date: '2024-01-10', count: 0 },
        { date: '2024-01-11', count: 10 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      // 5 is at 50% of range [0, 10], so level = round(0.5 * 4) = 2
      expect(result[0].neutralLevel).toBe(2)
    })

    it('clamps neutralValue outside data range', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        isDiverging: true,
        neutralValue: 100, // Outside range [0, 10]
      }
      const rawData = [
        { date: '2024-01-10', count: 0 },
        { date: '2024-01-11', count: 10 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      // Clamped to max (10) → 100% → level 4
      expect(result[0].neutralLevel).toBe(4)
    })

    it('forces missingMode to transparent', () => {
      const config: PipelineConfig = {
        mode: 'fixed',
        years: 1,
        isDiverging: true,
        missingMode: 'zero', // Should be ignored
      }
      const rawData = [{ date: '2024-01-15', count: 5 }]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      const missingDay = allDays.find((d) => d.date === '2024-01-10')
      expect(missingDay?.missing).toBe(true)
    })
  })
})

describe('calculateNeutralLevel', () => {
  it('returns center level when min equals max', () => {
    expect(calculateNeutralLevel(5, 5, 5)).toBe(2)
    expect(calculateNeutralLevel(0, 0, 5)).toBe(2)
    expect(calculateNeutralLevel(-5, -5, 5)).toBe(2)
  })

  it('defaults to 0 when zero is in range', () => {
    // Range [-10, 10], zero is at 50% → level 2
    expect(calculateNeutralLevel(-10, 10, 5)).toBe(2)
    // Range [-20, 5], zero is at 80% → level 3
    expect(calculateNeutralLevel(-20, 5, 5)).toBe(3)
    // Range [-5, 20], zero is at 20% → level 1
    expect(calculateNeutralLevel(-5, 20, 5)).toBe(1)
  })

  it('defaults to midpoint when zero is not in range', () => {
    // Range [5, 15], midpoint is 10 at 50% → level 2
    expect(calculateNeutralLevel(5, 15, 5)).toBe(2)
    // Range [-15, -5], midpoint is -10 at 50% → level 2
    expect(calculateNeutralLevel(-15, -5, 5)).toBe(2)
  })

  it('uses explicit neutralValue when provided', () => {
    // Range [0, 10], neutralValue 5 is at 50% → level 2
    expect(calculateNeutralLevel(0, 10, 5, 5)).toBe(2)
    // Range [0, 10], neutralValue 2 is at 20% → level 1
    expect(calculateNeutralLevel(0, 10, 5, 2)).toBe(1)
    // Range [0, 10], neutralValue 8 is at 80% → level 3
    expect(calculateNeutralLevel(0, 10, 5, 8)).toBe(3)
  })

  it('clamps neutralValue to data range', () => {
    // neutralValue 100 with range [0, 10] → clamped to 10 → level 4
    expect(calculateNeutralLevel(0, 10, 5, 100)).toBe(4)
    // neutralValue -100 with range [0, 10] → clamped to 0 → level 0
    expect(calculateNeutralLevel(0, 10, 5, -100)).toBe(0)
  })

  it('handles invalid neutralValue (NaN, Infinity)', () => {
    // NaN should fall back to default (0 in range)
    expect(calculateNeutralLevel(-10, 10, 5, NaN)).toBe(2)
    // Infinity should fall back to default
    expect(calculateNeutralLevel(-10, 10, 5, Infinity)).toBe(2)
    // -Infinity should fall back to default
    expect(calculateNeutralLevel(-10, 10, 5, -Infinity)).toBe(2)
  })

  it('works with different level counts', () => {
    // levelCount 3, zero in range [-10, 10] at 50% → level 1
    expect(calculateNeutralLevel(-10, 10, 3)).toBe(1)
    // levelCount 7, zero in range [-10, 10] at 50% → level 3
    expect(calculateNeutralLevel(-10, 10, 7)).toBe(3)
    // levelCount 9, zero in range [-10, 10] at 50% → level 4
    expect(calculateNeutralLevel(-10, 10, 9)).toBe(4)
  })
})
