import { describe, expect, it } from 'vitest'
import { getLocalizedMetadata } from '../metadata'

describe('getLocalizedMetadata', () => {
  it.each([
    ['en', 'Digital Pantry'],
    ['de', 'Digitale Vorratskammer'],
    ['pl', 'Cyfrowa Spiżarnia'],
  ])('returns the %s title', (locale, title) => {
    expect(getLocalizedMetadata(locale)).toMatchObject({ title })
  })

  it('translates the description too', () => {
    expect(getLocalizedMetadata('de').description).not.toBe(getLocalizedMetadata('en').description)
  })

  it('falls back to German for an unknown locale', () => {
    expect(getLocalizedMetadata('fr')).toEqual(getLocalizedMetadata('de'))
  })
})
