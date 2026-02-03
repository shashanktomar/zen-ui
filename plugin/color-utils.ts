/**
 * Color Utilities for zen-ui
 *
 * HSL-based color scale generation for heatmap levels.
 */

// Shared hex color validation
export const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

export function isValidHexColor(color: string | undefined): color is string {
  return typeof color === 'string' && HEX_COLOR_REGEX.test(color)
}

export interface HSL {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

/**
 * Parses a hex color string to HSL values.
 * Supports #RGB, #RRGGBB formats.
 */
export function hexToHSL(hex: string): HSL {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Expand shorthand (#RGB → #RRGGBB)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }

  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    // Achromatic (gray)
    return { h: 0, s: 0, l: l * 100 }
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h: number
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      break
    case g:
      h = ((b - r) / d + 2) / 6
      break
    default:
      h = ((r - g) / d + 4) / 6
      break
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Converts HSL values to a CSS hsl() string.
 */
export function hslToCSS(hsl: HSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
}

export interface ColorScaleOptions {
  maxLightness?: number // Lightness for lightest active level (default: 80)
  minLightness?: number // Lightness for darkest active level (default: 25)
  emptyLightness?: number // Lightness for level 0 (default: 92 light, 15 dark)
  darkMode?: boolean // If true, invert: brightest = highest level
}

/**
 * Generates a color scale for heatmap levels.
 *
 * Light mode (default):
 * - Level 0: very light tint (low activity background)
 * - Level 1: light shade
 * - Level N-1: dark shade (highest activity)
 *
 * Dark mode:
 * - Level 0: very dark tint
 * - Level 1: dark shade
 * - Level N-1: bright shade (highest activity)
 *
 * @param baseColor - Hex color string (e.g., "#40c463")
 * @param levelCount - Number of levels (2-10)
 * @param options - Optional configuration
 * @returns Array of CSS color strings, indexed by level
 */
export function generateColorScale(
  baseColor: string,
  levelCount: number,
  options: ColorScaleOptions = {},
): string[] {
  const {
    darkMode = false,
    maxLightness = 80,
    minLightness = 25,
    emptyLightness = darkMode ? 15 : 92,
  } = options

  const { h, s } = hexToHSL(baseColor)
  const colors: string[] = []

  // Level 0: very light (light mode) or very dark (dark mode) tint
  // Use lower saturation for the empty state to make it more neutral
  const emptySaturation = Math.max(5, Math.round(s * 0.3))
  colors.push(hslToCSS({ h, s: emptySaturation, l: emptyLightness }))

  const nonZeroLevels = levelCount - 1

  if (nonZeroLevels === 1) {
    // Only one non-zero level (binary mode): use original base color
    colors.push(baseColor)
  } else {
    // Distribute lightness across levels
    for (let i = 0; i < nonZeroLevels; i++) {
      const t = i / (nonZeroLevels - 1) // 0 to 1

      let l: number
      if (darkMode) {
        // Dark mode: level 1 = darkest, level N-1 = brightest
        l = minLightness + t * (maxLightness - minLightness)
      } else {
        // Light mode: level 1 = lightest, level N-1 = darkest
        l = maxLightness - t * (maxLightness - minLightness)
      }

      colors.push(hslToCSS({ h, s, l: Math.round(l) }))
    }
  }

  return colors
}

export interface DivergingColorScaleOptions {
  darkMode?: boolean
}

/**
 * Generates a diverging color scale with two color ramps meeting at a neutral point.
 *
 * @param negativeColor - Hex color for values below neutral (e.g., "#d73027" red)
 * @param positiveColor - Hex color for values above neutral (e.g., "#1a9850" green)
 * @param levelCount - Number of levels (must be odd, ≥3)
 * @param neutralLevel - Which level index is the neutral point
 * @param options - Optional configuration
 * @returns Array of CSS color strings, indexed by level
 */
export function generateDivergingColorScale(
  negativeColor: string,
  positiveColor: string,
  levelCount: number,
  neutralLevel: number,
  options: DivergingColorScaleOptions = {},
): string[] {
  const { darkMode = false } = options

  const negHSL = hexToHSL(negativeColor)
  const posHSL = hexToHSL(positiveColor)

  // Calculate neutral color: average hue with very low saturation
  const neutralHue = averageHue(negHSL.h, posHSL.h)
  const neutralSaturation = 8 // Very low saturation for neutral
  // Clamp lightness to safe band for readability
  const neutralLightness = darkMode ? 28 : 90

  const colors: string[] = []

  // Lightness ranges for the ramps (subtle range for better aesthetics)
  const lightRange = darkMode
    ? { light: 35, dark: 55 } // Dark mode: dark to bright
    : { light: 80, dark: 55 } // Light mode: light to dark (subtle)

  for (let i = 0; i < levelCount; i++) {
    if (i === neutralLevel) {
      // Neutral level
      colors.push(
        hslToCSS({ h: neutralHue, s: neutralSaturation, l: neutralLightness }),
      )
    } else if (i < neutralLevel) {
      // Negative ramp: level 0 is most intense negative, approaches neutral
      const negLevels = neutralLevel // Number of levels in negative ramp (excluding neutral)
      if (negLevels === 0) {
        // Edge case: neutralLevel is 0, no negative ramp
        colors.push(
          hslToCSS({
            h: neutralHue,
            s: neutralSaturation,
            l: neutralLightness,
          }),
        )
      } else {
        // t: 0 = most negative (level 0), 1 = closest to neutral
        const t = i / negLevels
        const l = darkMode
          ? lightRange.dark - t * (lightRange.dark - neutralLightness)
          : lightRange.dark + t * (neutralLightness - lightRange.dark)
        // Saturation: full at edges, decreases toward neutral
        const s = negHSL.s * (1 - t * 0.5)
        colors.push(
          hslToCSS({ h: negHSL.h, s: Math.round(s), l: Math.round(l) }),
        )
      }
    } else {
      // Positive ramp: approaches neutral from above, level N-1 is most intense
      const posLevels = levelCount - 1 - neutralLevel // Number of levels in positive ramp (excluding neutral)
      if (posLevels === 0) {
        // Edge case: neutralLevel is at max, no positive ramp
        colors.push(
          hslToCSS({
            h: neutralHue,
            s: neutralSaturation,
            l: neutralLightness,
          }),
        )
      } else {
        // t: 0 = closest to neutral, 1 = most positive (level N-1)
        const t = (i - neutralLevel) / posLevels
        const l = darkMode
          ? neutralLightness + t * (lightRange.dark - neutralLightness)
          : neutralLightness - t * (neutralLightness - lightRange.dark)
        // Saturation: increases from neutral toward edges
        const s = posHSL.s * (0.5 + t * 0.5)
        colors.push(
          hslToCSS({ h: posHSL.h, s: Math.round(s), l: Math.round(l) }),
        )
      }
    }
  }

  return colors
}

/**
 * Calculates the average of two hue values, accounting for circular hue space.
 */
function averageHue(h1: number, h2: number): number {
  // Handle circular hue (0-360)
  const diff = Math.abs(h1 - h2)
  if (diff <= 180) {
    return Math.round((h1 + h2) / 2)
  }
  // Go the "short way" around the circle
  const avg = (h1 + h2 + 360) / 2
  return Math.round(avg % 360)
}

/**
 * Default GitHub-style green color scale (5 levels).
 */
export const GITHUB_GREEN_SCALE = [
  'transparent', // Level 0: no activity (was #ebedf0, now transparent per user request)
  '#9be9a8', // Level 1: lightest green
  '#40c463', // Level 2: light green
  '#30a14e', // Level 3: medium green
  '#216e39', // Level 4: dark green
]

/**
 * Default base color (GitHub green, middle intensity).
 */
export const DEFAULT_BASE_COLOR = '#40c463'
