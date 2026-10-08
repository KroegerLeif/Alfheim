import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import { api } from '@/core/api/client'
import { translateLocal } from '@/i18n'
import { describeApiError, getServerMessage, messageFromBody } from '../apiErrors'

const t = (key: string, params?: Record<string, string | number>) => translateLocal('en', key, params) ?? key

/** Performs a real request through the app's ky client and returns the thrown error. */
async function failingRequest(status: number, body: string, contentType: string): Promise<unknown> {
  server.use(
    http.post('*/api/v1/households/join', () => new HttpResponse(body, { status, headers: { 'Content-Type': contentType } })),
  )
  return api.post('api/v1/households/join', { json: { token: 't' } }).json().catch((err: unknown) => err)
}

describe('describeApiError (issue #574)', () => {
  it('shows the backend message for a 409 conflict', async () => {
    const error = await failingRequest(
      409,
      JSON.stringify({ error: 'conflict', message: 'you are already a member of this household' }),
      'application/json',
    )
    expect(describeApiError(error, t)).toBe(
      'This conflicts with the current state. you are already a member of this household',
    )
  })

  it('shows the backend message for a 400 instead of the raw status line', async () => {
    const error = await failingRequest(
      400,
      JSON.stringify({ error: 'bad_request', message: 'user_id must be another member of the household' }),
      'application/json',
    )
    expect(describeApiError(error, t)).toBe('Something went wrong: user_id must be another member of the household')
  })

  it('reads JSON bodies that were sent as text/plain', async () => {
    const error = await failingRequest(
      409,
      '{"error":"conflict","message":"household slug already in use"}\n',
      'text/plain; charset=utf-8',
    )
    expect(getServerMessage(error)).toBe('household slug already in use')
  })

  it('explains invalid invites in the invite context', async () => {
    const error = await failingRequest(400, JSON.stringify({ error: 'bad_request', message: 'x' }), 'application/json')
    expect(describeApiError(error, t, 'invite')).toBe('This invite code is invalid, expired or has been revoked.')
  })

  it('keeps dedicated texts for 401, 403 and 404', async () => {
    const body = JSON.stringify({ error: 'x', message: 'raw' })
    expect(describeApiError(await failingRequest(401, body, 'application/json'), t)).toBe(
      'Your session has expired. Please sign in again.',
    )
    expect(describeApiError(await failingRequest(403, body, 'application/json'), t)).toBe(
      "You don't have permission to do this in this household.",
    )
    expect(describeApiError(await failingRequest(404, body, 'application/json'), t, 'household')).toBe(
      "This household doesn't exist or you are no longer a member.",
    )
  })

  it('falls back to the error message for non-HTTP errors', () => {
    expect(describeApiError(new Error('offline'), t)).toBe('Something went wrong: offline')
    expect(getServerMessage(new Error('offline'))).toBeUndefined()
  })
})

describe('messageFromBody', () => {
  it.each([
    [{ error: 'conflict', message: 'taken' }, 'taken'],
    [{ detail: 'plain detail' }, 'plain detail'],
    [{ detail: { code: 'household_forbidden', message: 'not a member' } }, 'not a member'],
    [{ error: 'Human readable error' }, 'Human readable error'],
    [{ error: 'bad_request' }, undefined],
    ['short text', 'short text'],
    ['   ', undefined],
    ['x'.repeat(301), undefined],
    ['"quoted"', '"quoted"'],
    [null, undefined],
    [42, undefined],
  ])('%j -> %s', (body, expected) => {
    expect(messageFromBody(body)).toBe(expected)
  })
})
