import { describe, expect, it } from 'vitest'
import { describeApiError, readApiError } from '../apiError'
import { makeHttpError } from '@/tests/utils'

const t = (key: string, params?: Record<string, string | number>) =>
  `${key}${params ? JSON.stringify(params) : ''}`

describe('readApiError', () => {
  it('reads code, count and message from the structured detail', async () => {
    const info = await readApiError(
      makeHttpError(409, { detail: { code: 'category_in_use', message: 'in use', item_count: 3 } })
    )
    expect(info).toEqual({ status: 409, code: 'category_in_use', itemCount: 3, detail: 'in use' })
  })

  it('reads a plain FastAPI detail string', async () => {
    const info = await readApiError(makeHttpError(400, { detail: 'Insufficient stock' }))
    expect(info).toEqual({ status: 400, code: null, itemCount: null, detail: 'Insufficient stock' })
  })

  it('joins validation messages and drops the pydantic prefix', async () => {
    const info = await readApiError(
      makeHttpError(422, { detail: [{ msg: 'Value error, bad unit' }, { msg: 'field required' }] })
    )
    expect(info.detail).toBe('bad unit; field required')
  })

  it('cuts overlong server text', async () => {
    const info = await readApiError(makeHttpError(400, { detail: 'x'.repeat(1000) }))
    expect(info.detail).toHaveLength(301)
    expect(info.detail?.endsWith('…')).toBe(true)
  })

  it('keeps the status when the body is not JSON', async () => {
    expect(await readApiError(makeHttpError(502))).toEqual({ status: 502, code: null, itemCount: null, detail: null })
  })

  it('reports no status for errors without a response', async () => {
    expect(await readApiError(new TypeError('Failed to fetch'))).toEqual({
      status: null, code: null, itemCount: null, detail: null,
    })
  })
})

describe('describeApiError', () => {
  it('maps a known code to its own message with the count', async () => {
    const error = makeHttpError(409, { detail: { code: 'product_in_use', message: 'x', item_count: 4 } })
    expect(await describeApiError(error, t, 'fallback', { codeKeys: { product_in_use: 'inUse' } })).toBe('inUse{"count":4}')
  })

  it('appends the server detail to the fallback message', async () => {
    const error = makeHttpError(400, { detail: 'Insufficient stock' })
    expect(await describeApiError(error, t, 'fallback')).toBe('fallback Insufficient stock')
  })

  it('uses only the fallback when the server gave no reason', async () => {
    expect(await describeApiError(makeHttpError(400), t, 'fallback')).toBe('fallback')
  })

  it('adds the unreachable hint when no response arrived', async () => {
    expect(await describeApiError(new TypeError('Failed to fetch'), t, 'fallback')).toBe('fallback pantry.errors.unreachable')
  })

  it('ignores an unmapped code and falls back', async () => {
    const error = makeHttpError(409, { detail: { code: 'other', message: 'boom' } })
    expect(await describeApiError(error, t, 'fallback', { codeKeys: { product_in_use: 'inUse' } })).toBe('fallback boom')
  })
})
