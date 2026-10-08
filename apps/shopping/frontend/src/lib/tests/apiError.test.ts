import { describe, it, expect } from 'vitest'
import { describeApiError } from '../apiError'

const BASE = 'Could not add the item.'
const UNREACHABLE = 'The service could not be reached.'

describe('describeApiError', () => {
  it('appends the server detail to the localized message', () => {
    expect(describeApiError({ status: 400, message: 'Shopping list not found.' }, BASE, UNREACHABLE)).toBe(
      'Could not add the item. Shopping list not found.'
    )
  })

  it('shows only the localized message when the server sent no text', () => {
    expect(describeApiError({ status: 502, message: '' }, BASE, UNREACHABLE)).toBe(BASE)
    expect(describeApiError({ status: 502, message: '   ' }, BASE, UNREACHABLE)).toBe(BASE)
  })

  it('hints that the service is unreachable when there was no response', () => {
    expect(describeApiError(new TypeError('Failed to fetch'), BASE, UNREACHABLE)).toBe(`${BASE} ${UNREACHABLE}`)
    expect(describeApiError({ message: 'timeout' }, BASE, UNREACHABLE)).toBe(`${BASE} ${UNREACHABLE}`)
    expect(describeApiError(undefined, BASE, UNREACHABLE)).toBe(`${BASE} ${UNREACHABLE}`)
  })

  it('cuts very long server text', () => {
    const message = describeApiError({ status: 500, message: 'x'.repeat(1000) }, BASE, UNREACHABLE)
    expect(message.length).toBeLessThan(BASE.length + 310)
    expect(message.endsWith('…')).toBe(true)
  })
})
