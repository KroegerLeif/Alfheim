import { describe, it, expect } from 'vitest'
import { NetworkError } from 'ky'
import { errorMessage } from '../errors'

describe('errorMessage', () => {
  it('uses the message of an Error', () => {
    expect(errorMessage(new Error('Conflict'), 'fallback')).toBe('Conflict')
  })

  it('uses the message of the plain objects thrown by the API client', () => {
    expect(errorMessage({ status: 409, message: 'Already claimed' }, 'fallback')).toBe('Already claimed')
  })

  it('uses the browser message of a ky NetworkError instead of its request description', () => {
    const error = new NetworkError(new Request('http://localhost/api/v1/templates'), {
      cause: new TypeError('Failed to fetch'),
    })
    expect(errorMessage(error, 'fallback')).toBe('Failed to fetch')
  })

  it.each([[{ status: 500, message: '' }], [{ status: 500 }], [null], [undefined], ['text'], [{ message: 42 }]])(
    'falls back to the localized text for %j',
    (value) => {
      expect(errorMessage(value, 'fallback')).toBe('fallback')
    }
  )
})
