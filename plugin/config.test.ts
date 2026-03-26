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

  describe('days validation', () => {
    it('accepts valid days', () => {
      expect(validateConfig(validConfig({ days: 7 })).days).toBe(7)
      expect(validateConfig(validConfig({ days: 30 })).days).toBe(30)
      expect(validateConfig(validConfig({ days: 90 })).days).toBe(90)
      expect(validateConfig(validConfig({ days: 365 })).days).toBe(365)
    })

    it('falls back to default for days below minimum', () => {
      expect(validateConfig(validConfig({ days: 3 })).days).toBe(364)
      expect(validateConfig(validConfig({ days: 6 })).days).toBe(364)
      expect(validateConfig(validConfig({ days: 0 })).days).toBe(364)
      expect(validateConfig(validConfig({ days: -1 })).days).toBe(364)
    })

    it('falls back to default for days above maximum', () => {
      expect(validateConfig(validConfig({ days: 366 })).days).toBe(364)
      expect(validateConfig(validConfig({ days: 500 })).days).toBe(364)
    })

    it('falls back to default for invalid types', () => {
      expect(validateConfig(validConfig({ days: 1.5 })).days).toBe(364)
      expect(validateConfig(validConfig({ days: 'thirty' })).days).toBe(364)
    })

    it('defaults to 364 when omitted', () => {
      expect(validateConfig(validConfig({})).days).toBe(364)
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

  describe('colorThresholds validation', () => {
    it('accepts valid colorThresholds with 2+ entries', () => {
      const config = validateConfig(
        validConfig({
          colorThresholds: [
            { value: 65, color: '#6E1F60' },
            { value: 75, color: '#73bf69' },
            { value: 90, color: '#ff9830' },
          ],
        }),
      )
      expect(config.colorThresholds).toEqual([
        { value: 65, color: '#6E1F60' },
        { value: 75, color: '#73bf69' },
        { value: 90, color: '#ff9830' },
      ])
    })

    it('auto-sorts by value ascending', () => {
      const config = validateConfig(
        validConfig({
          colorThresholds: [
            { value: 90, color: '#ff9830' },
            { value: 65, color: '#6E1F60' },
            { value: 75, color: '#73bf69' },
          ],
        }),
      )
      expect(config.colorThresholds).toEqual([
        { value: 65, color: '#6E1F60' },
        { value: 75, color: '#73bf69' },
        { value: 90, color: '#ff9830' },
      ])
    })

    it('ignores with fewer than 2 valid entries', () => {
      const config = validateConfig(
        validConfig({
          colorThresholds: [{ value: 65, color: '#6E1F60' }],
        }),
      )
      expect(config.colorThresholds).toBeUndefined()
    })

    it('ignores non-array input', () => {
      const config = validateConfig(validConfig({ colorThresholds: 'invalid' }))
      expect(config.colorThresholds).toBeUndefined()
    })

    it('filters out entries with invalid color', () => {
      const config = validateConfig(
        validConfig({
          colorThresholds: [
            { value: 65, color: 'not-hex' },
            { value: 75, color: '#73bf69' },
            { value: 90, color: '#ff9830' },
          ],
        }),
      )
      // First entry filtered, leaving 2 valid
      expect(config.colorThresholds).toEqual([
        { value: 75, color: '#73bf69' },
        { value: 90, color: '#ff9830' },
      ])
    })

    it('filters out entries with missing value', () => {
      const config = validateConfig(
        validConfig({
          colorThresholds: [
            { color: '#6E1F60' },
            { value: 75, color: '#73bf69' },
            { value: 90, color: '#ff9830' },
          ],
        }),
      )
      expect(config.colorThresholds).toEqual([
        { value: 75, color: '#73bf69' },
        { value: 90, color: '#ff9830' },
      ])
    })

    it('overrides levelCount to match threshold count', () => {
      const config = validateConfig(
        validConfig({
          levelCount: 5,
          colorThresholds: [
            { value: 65, color: '#6E1F60' },
            { value: 75, color: '#73bf69' },
            { value: 90, color: '#ff9830' },
          ],
        }),
      )
      expect(config.levelCount).toBe(3)
    })

    it('clears levelThresholds when colorThresholds is set', () => {
      const config = validateConfig(
        validConfig({
          levelCount: 3,
          levelThresholds: [33, 66],
          colorThresholds: [
            { value: 65, color: '#6E1F60' },
            { value: 75, color: '#73bf69' },
            { value: 90, color: '#ff9830' },
          ],
        }),
      )
      expect(config.levelThresholds).toBeUndefined()
      expect(config.colorThresholds).toBeDefined()
    })
  })

  describe('optional fields passthrough', () => {
    it('passes through title', () => {
      expect(validateConfig(validConfig({ title: 'My Graph' })).title).toBe(
        'My Graph',
      )
      expect(validateConfig(validConfig()).title).toBeUndefined()
    })

    it('passes through valid end_date', () => {
      expect(
        validateConfig(validConfig({ end_date: '2024-12-31' })).end_date,
      ).toBe('2024-12-31')
    })

    it('falls back to undefined for invalid end_date', () => {
      expect(
        validateConfig(validConfig({ end_date: 'not-a-date' })).end_date,
      ).toBeUndefined()
      expect(
        validateConfig(validConfig({ end_date: '' })).end_date,
      ).toBeUndefined()
      expect(
        validateConfig(validConfig({ end_date: 123 })).end_date,
      ).toBeUndefined()
    })

    it('passes through darkMode true', () => {
      expect(validateConfig(validConfig({ darkMode: true })).darkMode).toBe(
        true,
      )
    })

    it('passes through darkMode false', () => {
      expect(validateConfig(validConfig({ darkMode: false })).darkMode).toBe(
        false,
      )
    })

    it('defaults darkMode to undefined when omitted', () => {
      expect(validateConfig(validConfig()).darkMode).toBeUndefined()
    })

    it('ignores non-boolean darkMode', () => {
      expect(
        validateConfig(validConfig({ darkMode: 'yes' })).darkMode,
      ).toBeUndefined()
    })
  })
})
