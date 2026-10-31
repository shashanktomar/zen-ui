import { describe, it, expect } from 'vitest'
import { shortenLabels } from './labels'

describe('shortenLabels', () => {
  it('strips the shared prefix and suffix and capitalizes', () => {
    expect(
      shortenLabels(
        'Zonneplan Electricity returned today',
        'Zonneplan Electricity consumption today',
      ),
    ).toEqual(['Returned', 'Consumption'])
  })

  it('only strips whole words', () => {
    expect(shortenLabels('Solar power', 'Solar production')).toEqual([
      'Power',
      'Production',
    ])
  })

  it('keeps full labels when nothing is shared', () => {
    expect(shortenLabels('Export', 'Import')).toEqual(['Export', 'Import'])
  })

  it('keeps full labels when stripping would leave one empty', () => {
    expect(shortenLabels('Grid', 'Grid import')).toEqual([
      'Grid',
      'Grid import',
    ])
  })
})
