import { describe, it, expect } from 'vitest'
import {
  normalizeData,
  calculateDateRanges,
  getLevel,
  calculateEvenThresholds,
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
      name: 'levelCount=2 returns empty array (only 0 and 1 levels)',
      levelCount: 2,
      expected: [],
    },
    {
      name: 'levelCount=3 returns [50] (2 non-zero levels, 1 threshold)',
      levelCount: 3,
      expected: [50],
    },
    {
      name: 'levelCount=5 returns [25, 50, 75] (4 non-zero levels, 3 thresholds)',
      levelCount: 5,
      expected: [25, 50, 75],
    },
    {
      name: 'levelCount=10 returns 8 evenly distributed thresholds',
      levelCount: 10,
      expected: [
        100 / 9, // ~11.11
        200 / 9, // ~22.22
        300 / 9, // ~33.33
        400 / 9, // ~44.44
        500 / 9, // ~55.55
        600 / 9, // ~66.66
        700 / 9, // ~77.77
        800 / 9, // ~88.88
      ],
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
  describe('with default levelCount=5', () => {
    const testCases: Array<{
      name: string
      count: number
      maxCount: number
      thresholds?: number[]
      expected: number
    }> = [
      // Zero count always returns 0
      { name: 'count=0 returns level 0', count: 0, maxCount: 10, expected: 0 },
      {
        name: 'count=0, maxCount=0 returns level 0',
        count: 0,
        maxCount: 0,
        expected: 0,
      },

      // Edge case: non-zero count with maxCount=0
      {
        name: 'count>0, maxCount=0 returns level 1',
        count: 5,
        maxCount: 0,
        expected: 1,
      },

      // Default thresholds [25, 50, 75] with maxCount=100
      { name: '1% → level 1', count: 1, maxCount: 100, expected: 1 },
      {
        name: '25% → level 1 (boundary)',
        count: 25,
        maxCount: 100,
        expected: 1,
      },
      { name: '26% → level 2', count: 26, maxCount: 100, expected: 2 },
      {
        name: '50% → level 2 (boundary)',
        count: 50,
        maxCount: 100,
        expected: 2,
      },
      { name: '51% → level 3', count: 51, maxCount: 100, expected: 3 },
      {
        name: '75% → level 3 (boundary)',
        count: 75,
        maxCount: 100,
        expected: 3,
      },
      { name: '76% → level 4', count: 76, maxCount: 100, expected: 4 },
      { name: '100% → level 4', count: 100, maxCount: 100, expected: 4 },

      // Default thresholds with maxCount=8 (from plan example)
      {
        name: 'count=1/8 (12.5%) → level 1',
        count: 1,
        maxCount: 8,
        expected: 1,
      },
      { name: 'count=2/8 (25%) → level 1', count: 2, maxCount: 8, expected: 1 },
      {
        name: 'count=3/8 (37.5%) → level 2',
        count: 3,
        maxCount: 8,
        expected: 2,
      },
      {
        name: 'count=5/8 (62.5%) → level 3',
        count: 5,
        maxCount: 8,
        expected: 3,
      },
      {
        name: 'count=8/8 (100%) → level 4',
        count: 8,
        maxCount: 8,
        expected: 4,
      },

      // Custom thresholds [60, 80, 90] - emphasize high values
      {
        name: 'custom [60,80,90]: 50% → level 1',
        count: 50,
        maxCount: 100,
        thresholds: [60, 80, 90],
        expected: 1,
      },
      {
        name: 'custom [60,80,90]: 70% → level 2',
        count: 70,
        maxCount: 100,
        thresholds: [60, 80, 90],
        expected: 2,
      },
      {
        name: 'custom [60,80,90]: 85% → level 3',
        count: 85,
        maxCount: 100,
        thresholds: [60, 80, 90],
        expected: 3,
      },
      {
        name: 'custom [60,80,90]: 95% → level 4',
        count: 95,
        maxCount: 100,
        thresholds: [60, 80, 90],
        expected: 4,
      },

      // Custom thresholds [10, 25, 50] - emphasize any activity
      {
        name: 'custom [10,25,50]: 5% → level 1',
        count: 5,
        maxCount: 100,
        thresholds: [10, 25, 50],
        expected: 1,
      },
      {
        name: 'custom [10,25,50]: 15% → level 2',
        count: 15,
        maxCount: 100,
        thresholds: [10, 25, 50],
        expected: 2,
      },
      {
        name: 'custom [10,25,50]: 40% → level 3',
        count: 40,
        maxCount: 100,
        thresholds: [10, 25, 50],
        expected: 3,
      },
      {
        name: 'custom [10,25,50]: 60% → level 4',
        count: 60,
        maxCount: 100,
        thresholds: [10, 25, 50],
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

  describe('with levelCount=2 (binary: empty/active)', () => {
    it('count=0 returns level 0', () => {
      expect(getLevel(0, 10, 2)).toBe(0)
    })

    it('count>0 returns level 1', () => {
      expect(getLevel(1, 10, 2)).toBe(1)
      expect(getLevel(5, 10, 2)).toBe(1)
      expect(getLevel(10, 10, 2)).toBe(1)
    })
  })

  describe('with levelCount=3', () => {
    // Thresholds: [50] - two non-zero levels
    it('count=0 returns level 0', () => {
      expect(getLevel(0, 100, 3)).toBe(0)
    })

    it('1-50% returns level 1', () => {
      expect(getLevel(1, 100, 3)).toBe(1)
      expect(getLevel(50, 100, 3)).toBe(1)
    })

    it('51-100% returns level 2', () => {
      expect(getLevel(51, 100, 3)).toBe(2)
      expect(getLevel(100, 100, 3)).toBe(2)
    })
  })

  describe('with levelCount=10', () => {
    it('count=0 returns level 0', () => {
      expect(getLevel(0, 100, 10)).toBe(0)
    })

    it('distributes levels 1-9 across percentages', () => {
      // With 9 non-zero levels and 8 thresholds at ~11.1, 22.2, 33.3, etc.
      expect(getLevel(10, 100, 10)).toBe(1) // ~10% ≤ 11.1%
      expect(getLevel(20, 100, 10)).toBe(2) // ~20% ≤ 22.2%
      expect(getLevel(30, 100, 10)).toBe(3) // ~30% ≤ 33.3%
      expect(getLevel(40, 100, 10)).toBe(4) // ~40% ≤ 44.4%
      expect(getLevel(50, 100, 10)).toBe(5) // ~50% ≤ 55.5%
      expect(getLevel(60, 100, 10)).toBe(6) // ~60% ≤ 66.6%
      expect(getLevel(70, 100, 10)).toBe(7) // ~70% ≤ 77.7%
      expect(getLevel(80, 100, 10)).toBe(8) // ~80% ≤ 88.8%
      expect(getLevel(90, 100, 10)).toBe(9) // ~90% > 88.8%
      expect(getLevel(100, 100, 10)).toBe(9) // 100% → highest level
    })
  })

  describe('with custom thresholds for various level counts', () => {
    it('levelCount=3 with custom thresholds [30]', () => {
      expect(getLevel(0, 100, 3, [30])).toBe(0)
      expect(getLevel(20, 100, 3, [30])).toBe(1)
      expect(getLevel(30, 100, 3, [30])).toBe(1)
      expect(getLevel(50, 100, 3, [30])).toBe(2)
    })

    it('levelCount=10 with custom thresholds', () => {
      const customThresholds = [10, 20, 30, 40, 50, 60, 70, 80]
      expect(getLevel(5, 100, 10, customThresholds)).toBe(1)
      expect(getLevel(15, 100, 10, customThresholds)).toBe(2)
      expect(getLevel(85, 100, 10, customThresholds)).toBe(9)
    })
  })

  describe('negative values (clamp_zero behavior)', () => {
    it('negative count returns level 0 (treated as no activity)', () => {
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
        { date: '2024-01-03', count: 5, level: 2 }, // 50% of max
        { date: '2024-01-05', count: 10, level: 4 }, // 100% of max
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
        { date: '2024-01-03', count: 5, level: 4 }, // 100% of in-range max
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
        { date: '2024-01-15', count: 8, level: 4 },
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

    // Custom thresholds with default levelCount=5
    {
      name: 'custom thresholds affect levels',
      data: [
        { date: '2024-01-02', count: 10 },
        { date: '2024-01-03', count: 50 },
        { date: '2024-01-04', count: 80 },
        { date: '2024-01-05', count: 100 },
      ],
      range: range('2024-01-01', '2024-01-07'),
      thresholds: [10, 50, 80],
      expectMaxCount: 100,
      expectWeekCount: 1,
      expectDayCount: 7,
      expectSampleDays: [
        { date: '2024-01-02', count: 10, level: 1 }, // 10% = boundary of t1
        { date: '2024-01-03', count: 50, level: 2 }, // 50% = boundary of t2
        { date: '2024-01-04', count: 80, level: 3 }, // 80% = boundary of t3
        { date: '2024-01-05', count: 100, level: 4 }, // 100% > t3
      ],
    },

    // levelCount=2 (binary)
    {
      name: 'levelCount=2 produces binary levels',
      data: [
        { date: '2024-01-02', count: 1 },
        { date: '2024-01-03', count: 10 },
        { date: '2024-01-04', count: 100 },
      ],
      range: range('2024-01-01', '2024-01-07'),
      levelCount: 2,
      expectMaxCount: 100,
      expectWeekCount: 1,
      expectDayCount: 7,
      expectSampleDays: [
        { date: '2024-01-01', count: 0, level: 0 },
        { date: '2024-01-02', count: 1, level: 1 },
        { date: '2024-01-03', count: 10, level: 1 },
        { date: '2024-01-04', count: 100, level: 1 },
      ],
    },

    // levelCount=10 with auto thresholds
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
        { date: '2024-01-02', count: 10, level: 1 }, // 10% ≤ 11.1%
        { date: '2024-01-03', count: 50, level: 5 }, // 50% ≤ 55.5%
        { date: '2024-01-04', count: 90, level: 9 }, // 90% > 88.8%
        { date: '2024-01-05', count: 100, level: 9 }, // 100% → highest
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
      levelThresholds: [10, 20, 30], // Very low thresholds
    }
    const rawData = [
      { date: '2024-01-15', count: 100 }, // max
      { date: '2024-01-16', count: 25 }, // 25% of max
    ]
    const result = processHeatmapData(config, rawData, date(2024, 6, 20))

    const allDays = result[0].weeks.flat()
    const day16 = allDays.find((d) => d.date === '2024-01-16')

    // With thresholds [10, 20, 30], 25% should be level 3 (> 20%, <= 30%)
    expect(day16?.level).toBe(3)
  })

  describe('configurable levelCount', () => {
    it('defaults to 5 levels (0-4) when levelCount not specified', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1 }
      const rawData = [
        { date: '2024-01-15', count: 100 },
        { date: '2024-01-16', count: 76 }, // 76% → level 4
        { date: '2024-01-17', count: 51 }, // 51% → level 3
        { date: '2024-01-18', count: 26 }, // 26% → level 2
        { date: '2024-01-19', count: 1 }, // 1% → level 1
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(4)
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(4)
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(3)
      expect(allDays.find((d) => d.date === '2024-01-18')?.level).toBe(2)
      expect(allDays.find((d) => d.date === '2024-01-19')?.level).toBe(1)
    })

    it('supports levelCount=2 (binary levels)', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1, levelCount: 2 }
      const rawData = [
        { date: '2024-01-15', count: 100 },
        { date: '2024-01-16', count: 1 },
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-01')?.level).toBe(0) // no activity
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(1) // active
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(1) // active
    })

    it('supports levelCount=10', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1, levelCount: 10 }
      const rawData = [
        { date: '2024-01-15', count: 100 }, // max
        { date: '2024-01-16', count: 50 }, // 50% → level 5
        { date: '2024-01-17', count: 10 }, // 10% → level 1
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(9) // highest
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(5) // 50% ≤ 55.5%
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(1) // 10% ≤ 11.1%
    })

    it('clamps levelCount below 2 to 2', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1, levelCount: 0 }
      const rawData = [{ date: '2024-01-15', count: 100 }]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      // With levelCount=2, any non-zero count should be level 1
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
        levelThresholds: [30], // single threshold at 30%
      }
      const rawData = [
        { date: '2024-01-15', count: 100 }, // max
        { date: '2024-01-16', count: 25 }, // 25% ≤ 30% → level 1
        { date: '2024-01-17', count: 50 }, // 50% > 30% → level 2
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(2)
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(1)
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(2)
    })
  })

  describe('value_mode: clamp_zero (default)', () => {
    it('negative values are treated as level 0 by default', () => {
      const config: PipelineConfig = { mode: 'fixed', years: 1 }
      const rawData = [
        { date: '2024-01-15', count: 100 }, // max (positive)
        { date: '2024-01-16', count: -50 }, // negative → should be level 0
        { date: '2024-01-17', count: -5 }, // negative → should be level 0
        { date: '2024-01-18', count: 0 }, // zero → level 0
        { date: '2024-01-19', count: 25 }, // 25% → level 1
      ]
      const result = processHeatmapData(config, rawData, date(2024, 6, 20))

      const allDays = result[0].weeks.flat()
      expect(allDays.find((d) => d.date === '2024-01-15')?.level).toBe(4) // max
      expect(allDays.find((d) => d.date === '2024-01-16')?.level).toBe(0) // negative → 0
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(0) // negative → 0
      expect(allDays.find((d) => d.date === '2024-01-18')?.level).toBe(0) // zero → 0
      expect(allDays.find((d) => d.date === '2024-01-19')?.level).toBe(1) // 25%
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
      expect(allDays.find((d) => d.date === '2024-01-17')?.level).toBe(2) // 50%
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
})
