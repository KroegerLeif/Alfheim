import { describe, expect, it } from 'vitest'
import { getLocalizedMetadata } from '@/lib/metadata'

describe('getLocalizedMetadata', () => {
  it('returns the title and description in the requested locale', () => {
    expect(getLocalizedMetadata('en')).toEqual({ title: 'Alfheim Chat', description: 'Chat with ALFI, your household assistant.' })
    expect(getLocalizedMetadata('pl').title).toBe('Alfheim Czat')
  })

  it('falls back to German for unknown locales', () => {
    expect(getLocalizedMetadata('fr').description).toBe('Chatte mit ALFI, deinem Haushaltsassistenten.')
  })
})
