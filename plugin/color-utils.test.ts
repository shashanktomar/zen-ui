import { describe, it, expect } from 'vitest'
import {
  hexToHSL,
  hslToCSS,
  generateColorScale,
  generateDivergingColorScale,
  DEFAULT_BASE_COLOR,
} from './color-utils'

describe('hexToHSL', () => {
  const testCases = [
    // Pure colors
    { name: 'red #FF0000', hex: '#FF0000', expected: { h: 0, s: 100, l: 50 } },
    {
      name: 'green #00FF00',
      hex: '#00FF00',
      expected: { h: 120, s: 100, l: 50 },
    },
    {
      name: 'blue #0000FF',
      hex: '#0000FF',
      expected: { h: 240, s: 100, l: 50 },
    },

    // Grayscale
    { name: 'white #FFFFFF', hex: '#FFFFFF', expected: { h: 0, s: 0, l: 100 } },
    { name: 'black #000000', hex: '#000000', expected: { h: 0, s: 0, l: 0 } },
    { name: 'gray #808080', hex: '#808080', expected: { h: 0, s: 0, l: 50 } },

    // Shorthand
    { name: 'shorthand #F00', hex: '#F00', expected: { h: 0, s: 100, l: 50 } },
    {
      name: 'shorthand #0F0',
      hex: '#0F0',
      expected: { h: 120, s: 100, l: 50 },
    },

    // Without hash
    {
      name: 'no hash FF0000',
      hex: 'FF0000',
      expected: { h: 0, s: 100, l: 50 },
    },

    // GitHub green (approximate values due to rounding)
    {
      name: 'GitHub green #40c463',
      hex: '#40c463',
      expected: { h: 136, s: 53, l: 51 },
    },
  ]

  it.each(testCases)('$name', ({ hex, expected }) => {
    const result = hexToHSL(hex)
    expect(result.h).toBeCloseTo(expected.h, 0)
    expect(result.s).toBeCloseTo(expected.s, 0)
    expect(result.l).toBeCloseTo(expected.l, 0)
  })
})

describe('hslToCSS', () => {
  it('formats HSL as CSS string', () => {
    expect(hslToCSS({ h: 120, s: 50, l: 75 })).toBe('hsl(120, 50%, 75%)')
  })

  it('handles zero values', () => {
    expect(hslToCSS({ h: 0, s: 0, l: 0 })).toBe('hsl(0, 0%, 0%)')
  })

  it('handles max values', () => {
    expect(hslToCSS({ h: 360, s: 100, l: 100 })).toBe('hsl(360, 100%, 100%)')
  })
})

describe('generateColorScale', () => {
  // Helper to extract lightness from HSL string
  const getLightness = (hsl: string): number => {
    const match = hsl.match(/hsl\(\d+, \d+%, (\d+)%\)/)
    return match ? parseInt(match[1]) : -1
  }

  it('generates correct number of colors', () => {
    expect(generateColorScale('#40c463', 2)).toHaveLength(2)
    expect(generateColorScale('#40c463', 5)).toHaveLength(5)
    expect(generateColorScale('#40c463', 10)).toHaveLength(10)
  })

  it('level 0 is a very light tint (not transparent)', () => {
    const colors = generateColorScale('#40c463', 5)
    // Level 0 should be a valid HSL color with high lightness
    expect(colors[0]).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
    expect(getLightness(colors[0])).toBe(92) // Default empty lightness
  })

  it('level 0 has reduced saturation for neutral appearance', () => {
    const colors = generateColorScale('#40c463', 5) // s=53
    // Empty state should have ~16% saturation (53 * 0.3)
    expect(colors[0]).toMatch(/^hsl\(136, 16%, 92%\)$/)
  })

  it('preserves hue and saturation from base color for active levels', () => {
    const colors = generateColorScale('#40c463', 5) // GitHub green, h≈136, s≈53

    // Active levels (1+) should have same hue and saturation
    for (let i = 1; i < colors.length; i++) {
      expect(colors[i]).toMatch(/^hsl\(136, 53%/)
    }
  })

  describe('light mode (default)', () => {
    it('lightness decreases from level 1 to max level (light to dark)', () => {
      const colors = generateColorScale('#40c463', 5, {
        maxLightness: 80,
        minLightness: 20,
      })

      const lightnessValues = colors.slice(1).map(getLightness)

      // Level 1 should be lightest
      expect(lightnessValues[0]).toBe(80)
      // Level 4 should be darkest
      expect(lightnessValues[3]).toBe(20)
      // Should be in descending order
      for (let i = 1; i < lightnessValues.length; i++) {
        expect(lightnessValues[i]).toBeLessThan(lightnessValues[i - 1])
      }
    })
  })

  describe('dark mode', () => {
    it('lightness increases from level 1 to max level (dark to bright)', () => {
      const colors = generateColorScale('#40c463', 5, {
        darkMode: true,
        maxLightness: 80,
        minLightness: 20,
      })

      const lightnessValues = colors.slice(1).map(getLightness)

      // Level 1 should be darkest
      expect(lightnessValues[0]).toBe(20)
      // Level 4 should be brightest
      expect(lightnessValues[3]).toBe(80)
      // Should be in ascending order
      for (let i = 1; i < lightnessValues.length; i++) {
        expect(lightnessValues[i]).toBeGreaterThan(lightnessValues[i - 1])
      }
    })

    it('level 0 is very dark in dark mode', () => {
      const colors = generateColorScale('#40c463', 5, { darkMode: true })
      expect(getLightness(colors[0])).toBe(15) // Default dark mode empty lightness
    })

    it('custom empty lightness in dark mode', () => {
      const colors = generateColorScale('#40c463', 5, {
        darkMode: true,
        emptyLightness: 10,
      })
      expect(getLightness(colors[0])).toBe(10)
    })
  })

  it('works with levelCount=2 (binary) - uses original color', () => {
    const baseColor = '#40c463'
    const colors = generateColorScale(baseColor, 2, {
      maxLightness: 80,
      minLightness: 20,
    })

    expect(colors).toHaveLength(2)
    expect(colors[0]).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/) // Light tint for empty
    // Single non-zero level should use original base color
    expect(colors[1]).toBe(baseColor)
  })

  it('uses custom lightness range', () => {
    const colors = generateColorScale('#FF0000', 3, {
      maxLightness: 90,
      minLightness: 10,
    })

    expect(colors[0]).toMatch(/^hsl\(0, 30%, 92%\)$/) // Light tint with reduced saturation
    expect(colors[1]).toBe('hsl(0, 100%, 90%)') // Lightest active
    expect(colors[2]).toBe('hsl(0, 100%, 10%)') // Darkest active
  })

  it('works with default base color', () => {
    const colors = generateColorScale(DEFAULT_BASE_COLOR, 5)

    expect(colors).toHaveLength(5)
    // All colors should be valid HSL
    for (const color of colors) {
      expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
    }
  })

  describe('levelCount variations', () => {
    const levelCounts = [2, 3, 4, 5, 6, 7, 8, 9, 10]

    it.each(levelCounts)('generates %i levels correctly', (levelCount) => {
      const baseColor = '#40c463'
      const colors = generateColorScale(baseColor, levelCount)

      expect(colors).toHaveLength(levelCount)

      // All levels should be valid HSL or hex (for binary mode)
      const hslOrHexPattern = /^(hsl\(\d+, \d+%, [\d.]+%\)|#[0-9A-Fa-f]{3,6})$/
      for (const color of colors) {
        expect(color).toMatch(hslOrHexPattern)
      }

      // For binary mode (levelCount=2), level 1 should be original color
      if (levelCount === 2) {
        expect(colors[1]).toBe(baseColor)
      }
    })
  })
})

describe('generateDivergingColorScale', () => {
  const negativeColor = '#d73027' // Red
  const positiveColor = '#1a9850' // Green

  // Helper to extract hue from HSL string
  const getHue = (hsl: string): number => {
    const match = hsl.match(/hsl\((\d+),/)
    return match ? parseInt(match[1]) : -1
  }

  // Helper to extract saturation from HSL string
  const getSaturation = (hsl: string): number => {
    const match = hsl.match(/hsl\(\d+, (\d+)%/)
    return match ? parseInt(match[1]) : -1
  }

  it('generates correct number of colors', () => {
    expect(
      generateDivergingColorScale(negativeColor, positiveColor, 3, 1),
    ).toHaveLength(3)
    expect(
      generateDivergingColorScale(negativeColor, positiveColor, 5, 2),
    ).toHaveLength(5)
    expect(
      generateDivergingColorScale(negativeColor, positiveColor, 7, 3),
    ).toHaveLength(7)
  })

  describe('symmetric neutral (center)', () => {
    it('neutral level has very low saturation', () => {
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        2,
      )
      const neutralSaturation = getSaturation(colors[2])
      expect(neutralSaturation).toBeLessThanOrEqual(10)
    })

    it('levels below neutral use negative color hue', () => {
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        2,
      )
      const negativeHue = hexToHSL(negativeColor).h
      // Level 0 and 1 should use negative hue
      expect(getHue(colors[0])).toBeCloseTo(negativeHue, -1)
      expect(getHue(colors[1])).toBeCloseTo(negativeHue, -1)
    })

    it('levels above neutral use positive color hue', () => {
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        2,
      )
      const positiveHue = hexToHSL(positiveColor).h
      // Level 3 and 4 should use positive hue
      expect(getHue(colors[3])).toBeCloseTo(positiveHue, -1)
      expect(getHue(colors[4])).toBeCloseTo(positiveHue, -1)
    })
  })

  describe('asymmetric neutral', () => {
    it('neutral at level 1 creates more positive levels', () => {
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        1,
      )
      // Level 0: negative, Level 1: neutral, Levels 2-4: positive
      expect(getSaturation(colors[1])).toBeLessThanOrEqual(10) // Neutral
      expect(colors).toHaveLength(5)
    })

    it('neutral at level 3 creates more negative levels', () => {
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        3,
      )
      // Levels 0-2: negative, Level 3: neutral, Level 4: positive
      expect(getSaturation(colors[3])).toBeLessThanOrEqual(10) // Neutral
    })
  })

  describe('edge cases', () => {
    it('neutral at level 0 (all positive)', () => {
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        0,
      )
      expect(getSaturation(colors[0])).toBeLessThanOrEqual(10) // Neutral at 0
      // All other levels should be positive
      const positiveHue = hexToHSL(positiveColor).h
      for (let i = 1; i < 5; i++) {
        expect(getHue(colors[i])).toBeCloseTo(positiveHue, -1)
      }
    })

    it('neutral at max level (all negative)', () => {
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        4,
      )
      expect(getSaturation(colors[4])).toBeLessThanOrEqual(10) // Neutral at 4
      // All other levels should be negative
      const negativeHue = hexToHSL(negativeColor).h
      for (let i = 0; i < 4; i++) {
        expect(getHue(colors[i])).toBeCloseTo(negativeHue, -1)
      }
    })
  })

  describe('dark mode', () => {
    it('generates valid colors in dark mode', () => {
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        2,
        { darkMode: true },
      )

      expect(colors).toHaveLength(5)
      for (const color of colors) {
        expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
      }
    })

    it('neutral has different lightness in dark mode', () => {
      const lightColors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        2,
      )
      const darkColors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        5,
        2,
        { darkMode: true },
      )

      const getLightness = (hsl: string): number => {
        const match = hsl.match(/hsl\(\d+, \d+%, (\d+)%\)/)
        return match ? parseInt(match[1]) : -1
      }

      // Dark mode neutral should be darker than light mode neutral
      expect(getLightness(darkColors[2])).toBeLessThan(
        getLightness(lightColors[2]),
      )
    })
  })

  describe('various level counts', () => {
    const levelCounts = [3, 5, 7, 9]

    it.each(levelCounts)('generates %i levels correctly', (levelCount) => {
      const neutralLevel = Math.floor(levelCount / 2)
      const colors = generateDivergingColorScale(
        negativeColor,
        positiveColor,
        levelCount,
        neutralLevel,
      )

      expect(colors).toHaveLength(levelCount)

      // All levels should be valid HSL
      for (const color of colors) {
        expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/)
      }

      // Neutral level should have low saturation
      expect(getSaturation(colors[neutralLevel])).toBeLessThanOrEqual(10)
    })
  })
})
