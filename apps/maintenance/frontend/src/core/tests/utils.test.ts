import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  daysUntil,
  dueStatusFromDays,
  formatDate,
  getDueStatus,
  parseCalendarDate,
  DUE_SOON_THRESHOLD_DAYS,
} from '../utils'

/**
 * Regression tests for issue #500: date-only strings were parsed as UTC midnight, which is the previous
 * calendar day in every timezone behind UTC. Each case runs under a negative, a zero and a positive offset.
 */
const ZONES = [
  { zone: 'America/Los_Angeles', offsetSign: 'negative' },
  { zone: 'America/Sao_Paulo', offsetSign: 'negative' },
  { zone: 'UTC', offsetSign: 'zero' },
  { zone: 'Pacific/Auckland', offsetSign: 'positive' },
] as const

describe.each(ZONES)('calendar date math in $zone', ({ zone, offsetSign }) => {
  const originalZone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = zone
  })

  afterAll(() => {
    if (originalZone === undefined) delete process.env.TZ
    else process.env.TZ = originalZone
  })

  it('runs in the requested timezone', () => {
    const offset = new Date(2025, 5, 15, 12).getTimezoneOffset()
    if (offsetSign === 'negative') expect(offset).toBeGreaterThan(0)
    if (offsetSign === 'zero') expect(offset).toBe(0)
    if (offsetSign === 'positive') expect(offset).toBeLessThan(0)
  })

  it('parses a date-only string as the same local calendar day', () => {
    const date = parseCalendarDate('2025-02-01')
    expect(date?.getFullYear()).toBe(2025)
    expect(date?.getMonth()).toBe(1)
    expect(date?.getDate()).toBe(1)
  })

  it('counts a step due tomorrow as one day away at any time of day', () => {
    for (const hour of [0, 1, 6, 12, 18, 23]) {
      const now = new Date(2025, 5, 15, hour, 30)
      expect(daysUntil('2025-06-16', now)).toBe(1)
    }
  })

  it('counts a step due today as zero days away and yesterday as overdue', () => {
    const now = new Date(2025, 5, 15, 23, 59)
    expect(daysUntil('2025-06-15', now)).toBe(0)
    expect(daysUntil('2025-06-14', now)).toBe(-1)
    expect(getDueStatus('2025-06-15', now)).toBe('due_soon')
    expect(getDueStatus('2025-06-14', now)).toBe('overdue')
  })

  it('keeps the due-soon boundary at exactly 14 days', () => {
    const now = new Date(2025, 5, 15, 9)
    expect(getDueStatus('2025-06-29', now)).toBe('due_soon')
    expect(getDueStatus('2025-06-30', now)).toBe('ok')
  })

  it('formats the stored day, not the previous one', () => {
    expect(formatDate('2025-02-01', 'en')).toBe('Feb 1, 2025')
  })
})

describe('daysUntil across daylight saving changes', () => {
  const originalZone = process.env.TZ

  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles'
  })

  afterAll(() => {
    if (originalZone === undefined) delete process.env.TZ
    else process.env.TZ = originalZone
  })

  it('counts whole calendar days over the spring-forward and fall-back weekends', () => {
    // 2025-03-09 is 23 hours long and 2025-11-02 is 25 hours long in Los Angeles.
    expect(daysUntil('2025-03-10', new Date(2025, 2, 8, 12))).toBe(2)
    expect(daysUntil('2025-11-03', new Date(2025, 10, 1, 12))).toBe(2)
  })
})

describe('parseCalendarDate', () => {
  it('returns null for empty, malformed and overflowing input', () => {
    expect(parseCalendarDate(undefined)).toBeNull()
    expect(parseCalendarDate(null)).toBeNull()
    expect(parseCalendarDate('')).toBeNull()
    expect(parseCalendarDate('not-a-date')).toBeNull()
    expect(parseCalendarDate('2025-02-31')).toBeNull()
  })

  it('reduces a full timestamp to a local calendar day', () => {
    const date = parseCalendarDate('2025-06-15T10:30:00')
    expect(date?.getFullYear()).toBe(2025)
    expect(date?.getMonth()).toBe(5)
    expect(date?.getDate()).toBe(15)
    expect(date?.getHours()).toBe(0)
  })
})

describe('daysUntil without a usable date', () => {
  it('returns null instead of pretending the step is due today', () => {
    expect(daysUntil(undefined)).toBeNull()
    expect(daysUntil(null)).toBeNull()
    expect(daysUntil('garbage')).toBeNull()
  })
})

describe('dueStatusFromDays', () => {
  it('classifies day counts like the backend maintenance summary', () => {
    expect(dueStatusFromDays(null)).toBe('unscheduled')
    expect(dueStatusFromDays(-1)).toBe('overdue')
    expect(dueStatusFromDays(0)).toBe('due_soon')
    expect(dueStatusFromDays(DUE_SOON_THRESHOLD_DAYS)).toBe('due_soon')
    expect(dueStatusFromDays(DUE_SOON_THRESHOLD_DAYS + 1)).toBe('ok')
  })
})

describe('formatDate', () => {
  it('formats in the requested locale', () => {
    expect(formatDate('2025-02-01', 'de')).toContain('2025')
    expect(formatDate('2025-02-01', 'de')).toMatch(/Feb/)
    expect(formatDate('2025-05-01', 'pl')).toContain('2025')
  })

  it('returns null for missing or invalid dates so callers can show a localized placeholder', () => {
    expect(formatDate(undefined, 'en')).toBeNull()
    expect(formatDate('nope', 'en')).toBeNull()
  })
})
