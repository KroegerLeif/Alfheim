import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from '../format'

describe('formatDate', () => {
  it('keeps a date-only value on its calendar day', () => {
    expect(formatDate('2026-03-01', 'de')).toBe('1.3.2026')
    expect(formatDate('2026-03-01', 'en-GB')).toBe('01/03/2026')
  })

  it('returns unparsable values unchanged', () => {
    expect(formatDate('not a date', 'en')).toBe('not a date')
  })
})

describe('formatDateTime', () => {
  it('includes the time of day', () => {
    expect(formatDateTime(new Date(2026, 5, 15, 14, 30).toISOString(), 'de')).toMatch(/14:30/)
  })

  it('returns unparsable values unchanged', () => {
    expect(formatDateTime('nope', 'en')).toBe('nope')
  })
})
