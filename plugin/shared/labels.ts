/**
 * Label utilities
 */

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Shortens two related labels by stripping the words they share at the start
 * and end, e.g. "Zonneplan Electricity returned today" and
 * "Zonneplan Electricity consumption today" → "Returned", "Consumption".
 * Returns the original labels if stripping would leave either one empty.
 */
export function shortenLabels(a: string, b: string): [string, string] {
  const wordsA = a.split(' ')
  const wordsB = b.split(' ')
  const maxShared = Math.min(wordsA.length, wordsB.length) - 1

  let prefix = 0
  while (prefix < maxShared && wordsA[prefix] === wordsB[prefix]) prefix++

  let suffix = 0
  while (
    suffix < maxShared - prefix &&
    wordsA[wordsA.length - 1 - suffix] === wordsB[wordsB.length - 1 - suffix]
  ) {
    suffix++
  }

  const shortA = wordsA.slice(prefix, wordsA.length - suffix).join(' ')
  const shortB = wordsB.slice(prefix, wordsB.length - suffix).join(' ')

  if (!shortA || !shortB) return [a, b]
  return [capitalize(shortA), capitalize(shortB)]
}
