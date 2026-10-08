import { describe, it, expect } from 'vitest'
import { errorMessage } from '../errors'

describe('errorMessage', () => {
  it('uses the message of an Error', () => {
    expect(errorMessage(new Error('Conflict'), 'fallback')).toBe('Conflict')
  })

  it('uses the message of the plain objects thrown by the API client', () => {
    expect(errorMessage({ status: 409, message: 'Already claimed' }, 'fallback')).toBe('Already claimed')
  })

  it.each([[{ status: 500, message: '' }], [{ status: 500 }], [null], [undefined], ['text'], [{ message: 42 }]])(
    'falls back to the localized text for %j',
    (value) => {
      expect(errorMessage(value, 'fallback')).toBe('fallback')
    }
  )
})
