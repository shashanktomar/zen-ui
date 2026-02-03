import { describe, it, expect } from 'vitest'
import { validateConfig, CONFIG_DEFAULTS } from './config'

// Helper to create a minimal valid config
const validConfig = (overrides = {}) => ({
  entity: 'sensor.test',
  card: 'heatmap' as const,
  ...overrides,
})

describe('validateConfig', () => {
  describe('required fields', () => {
    it('throws if config is not an object', () => {
      expect(() => validateConfig(null)).toThrow(
        'Configuration must be an object',
      )
      expect(() => validateConfig(undefined)).toThrow(
        'Configuration must be an object',
      )
      expect(() => validateConfig('string')).toThrow(
        'Configuration must be an object',
      )
    })

    it('throws if entity is missing', () => {
      expect(() => validateConfig({ card: 'heatmap' })).toThrow()
    })

    it('allows empty entity for preview mode', () => {
      const config = validateConfig({ card: 'heatmap', entity: '' })
      expect(config.entity).toBe('')

      const configWithSpaces = validateConfig({
        card: 'heatmap',
        entity: '   ',
      })
      expect(configWithSpaces.entity).toBe('')
    })

    it('throws if card is missing', () => {
      expect(() => validateConfig({ entity: 'sensor.test' })).toThrow()
    })

    it('accepts valid required fields', () => {
      const config = validateConfig(validConfig())
      expect(config.entity).toBe('sensor.test')
      expect(config.card).toBe('heatmap')
    })
  })

  describe('defaults', () => {
    it('applies all defaults for minimal config', () => {
      const config = validateConfig(validConfig())

      expect(config.range).toBe(CONFIG_DEFAULTS.range)
      expect(config.years).toBe(CONFIG_DEFAULTS.years)
      expect(config.weekStartDay).toBe(CONFIG_DEFAULTS.weekStartDay)
      expect(config.weekdayLabels).toBe(CONFIG_DEFAULTS.weekdayLabels)
      expect(config.levelCount).toBe(CONFIG_DEFAULTS.levelCount)
      expect(config.baseColor).toBe(CONFIG_DEFAULTS.baseColor)
      expect(config.show_legend).toBe(CONFIG_DEFAULTS.show_legend)
      expect(config.attribute).toBe(CONFIG_DEFAULTS.attribute)
    })
  })

  describe('card type validation', () => {
    it('accepts valid card type', () => {
      expect(validateConfig(validConfig({ card: 'heatmap' })).card).toBe(
        'heatmap',
      )
    })

    it('throws for invalid card type', () => {
      expect(() => validateConfig(validConfig({ card: 'invalid' }))).toThrow()
      expect(() => validateConfig(validConfig({ card: 123 }))).toThrow()
    })
  })

  describe('range validation', () => {
    it('accepts valid range values', () => {
      expect(validateConfig(validConfig({ range: 'rolling' })).range).toBe(
        'rolling',
      )
      expect(validateConfig(validConfig({ range: 'year' })).range).toBe('year')
    })

    it('falls back to default for invalid range', () => {
      expect(validateConfig(validConfig({ range: 'invalid' })).range).toBe(
        'rolling',
      )
      expect(validateConfig(validConfig({ range: 123 })).range).toBe('rolling')
    })
  })

  describe('years validation', () => {
    it('accepts valid years', () => {
      expect(validateConfig(validConfig({ years: 1 })).years).toBe(1)
      expect(validateConfig(validConfig({ years: 3 })).years).toBe(3)
      expect(validateConfig(validConfig({ years: 10 })).years).toBe(10)
    })

    it('falls back to default for invalid years', () => {
      expect(validateConfig(validConfig({ years: 0 })).years).toBe(1)
      expect(validateConfig(validConfig({ years: -1 })).years).toBe(1)
      expect(validateConfig(validConfig({ years: 1.5 })).years).toBe(1)
      expect(validateConfig(validConfig({ years: 'two' })).years).toBe(1)
    })
  })

  describe('weekStartDay validation', () => {
    it('accepts string values (case-insensitive)', () => {
      expect(
        validateConfig(validConfig({ weekStartDay: 'sunday' })).weekStartDay,
      ).toBe('sunday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'Sunday' })).weekStartDay,
      ).toBe('sunday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'SUNDAY' })).weekStartDay,
      ).toBe('sunday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'monday' })).weekStartDay,
      ).toBe('monday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'Monday' })).weekStartDay,
      ).toBe('monday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'MONDAY' })).weekStartDay,
      ).toBe('monday')
    })

    it('accepts short forms', () => {
      expect(
        validateConfig(validConfig({ weekStartDay: 'sun' })).weekStartDay,
      ).toBe('sunday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'Sun' })).weekStartDay,
      ).toBe('sunday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'mon' })).weekStartDay,
      ).toBe('monday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'Mon' })).weekStartDay,
      ).toBe('monday')
    })

    it('accepts legacy number values', () => {
      expect(
        validateConfig(validConfig({ weekStartDay: 0 })).weekStartDay,
      ).toBe('sunday')
      expect(
        validateConfig(validConfig({ weekStartDay: 1 })).weekStartDay,
      ).toBe('monday')
    })

    it('falls back to default for invalid weekStartDay', () => {
      expect(
        validateConfig(validConfig({ weekStartDay: 2 })).weekStartDay,
      ).toBe('monday')
      expect(
        validateConfig(validConfig({ weekStartDay: -1 })).weekStartDay,
      ).toBe('monday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'tuesday' })).weekStartDay,
      ).toBe('monday')
      expect(
        validateConfig(validConfig({ weekStartDay: 'invalid' })).weekStartDay,
      ).toBe('monday')
    })
  })

  describe('levelCount validation', () => {
    it('accepts valid levelCount (2-10)', () => {
      expect(validateConfig(validConfig({ levelCount: 2 })).levelCount).toBe(2)
      expect(validateConfig(validConfig({ levelCount: 5 })).levelCount).toBe(5)
      expect(validateConfig(validConfig({ levelCount: 10 })).levelCount).toBe(
        10,
      )
    })

    it('falls back to default for invalid levelCount', () => {
      expect(validateConfig(validConfig({ levelCount: 1 })).levelCount).toBe(5)
      expect(validateConfig(validConfig({ levelCount: 11 })).levelCount).toBe(5)
      expect(validateConfig(validConfig({ levelCount: 0 })).levelCount).toBe(5)
      expect(
        validateConfig(validConfig({ levelCount: 'five' })).levelCount,
      ).toBe(5)
    })
  })

  describe('baseColor validation', () => {
    it('accepts valid hex colors', () => {
      expect(validateConfig(validConfig({ baseColor: '#fff' })).baseColor).toBe(
        '#fff',
      )
      expect(validateConfig(validConfig({ baseColor: '#FFF' })).baseColor).toBe(
        '#FFF',
      )
      expect(
        validateConfig(validConfig({ baseColor: '#40c463' })).baseColor,
      ).toBe('#40c463')
      expect(
        validateConfig(validConfig({ baseColor: '#AABBCC' })).baseColor,
      ).toBe('#AABBCC')
    })

    it('falls back to default for invalid colors', () => {
      expect(validateConfig(validConfig({ baseColor: 'red' })).baseColor).toBe(
        '#40c463',
      )
      expect(
        validateConfig(validConfig({ baseColor: '#gg0000' })).baseColor,
      ).toBe('#40c463')
      expect(
        validateConfig(validConfig({ baseColor: 'ffffff' })).baseColor,
      ).toBe('#40c463')
      expect(
        validateConfig(validConfig({ baseColor: '#12345' })).baseColor,
      ).toBe('#40c463')
    })
  })

  describe('weekdayLabels validation', () => {
    it('accepts valid weekdayLabels values', () => {
      expect(
        validateConfig(validConfig({ weekdayLabels: 'none' })).weekdayLabels,
      ).toBe('none')
      expect(
        validateConfig(validConfig({ weekdayLabels: 'short' })).weekdayLabels,
      ).toBe('short')
      expect(
        validateConfig(validConfig({ weekdayLabels: 'all' })).weekdayLabels,
      ).toBe('all')
      expect(
        validateConfig(validConfig({ weekdayLabels: 'letter' })).weekdayLabels,
      ).toBe('letter')
    })

    it('defaults to short', () => {
      expect(validateConfig(validConfig()).weekdayLabels).toBe('short')
    })

    it('falls back to default for invalid weekdayLabels', () => {
      expect(
        validateConfig(validConfig({ weekdayLabels: 'invalid' })).weekdayLabels,
      ).toBe('short')
      expect(
        validateConfig(validConfig({ weekdayLabels: 123 })).weekdayLabels,
      ).toBe('short')
      expect(
        validateConfig(validConfig({ weekdayLabels: '' })).weekdayLabels,
      ).toBe('short')
    })
  })

  describe('levelThresholds validation', () => {
    it('accepts thresholds matching levelCount', () => {
      // levelCount=5 needs 4 thresholds
      const config = validateConfig(
        validConfig({
          levelCount: 5,
          levelThresholds: [25, 50, 75, 90],
        }),
      )
      expect(config.levelThresholds).toEqual([25, 50, 75, 90])
    })

    it('ignores thresholds with wrong length', () => {
      // levelCount=5 needs 4 thresholds, but we provide 3
      const config = validateConfig(
        validConfig({
          levelCount: 5,
          levelThresholds: [25, 50, 75],
        }),
      )
      expect(config.levelThresholds).toBeUndefined()
    })

    it('validates against default levelCount when not specified', () => {
      // Default levelCount=5 needs 4 thresholds
      const config = validateConfig(
        validConfig({
          levelThresholds: [25, 50, 75, 90],
        }),
      )
      expect(config.levelThresholds).toEqual([25, 50, 75, 90])
    })
  })

  describe('optional fields passthrough', () => {
    it('passes through title', () => {
      expect(validateConfig(validConfig({ title: 'My Graph' })).title).toBe(
        'My Graph',
      )
      expect(validateConfig(validConfig()).title).toBeUndefined()
    })

    it('passes through end_date', () => {
      expect(
        validateConfig(validConfig({ end_date: '2024-12-31' })).end_date,
      ).toBe('2024-12-31')
    })
  })
})
