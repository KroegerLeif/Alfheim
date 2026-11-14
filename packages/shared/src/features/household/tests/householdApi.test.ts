import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApiClient } from '../../api/client'
import { fetchMyHouseholds } from '../householdApi'

/** A fetch that never answers on its own and only settles when its signal aborts. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
  })

describe('fetchMyHouseholds', () => {
  beforeEach(() => {
    sessionStorage.setItem('alfheim_access_token', 'token-1')
  })
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('ends a request that never resolves as a network failure, which the gate shows as retry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = createApiClient({ fetch: hangingFetch, timeoutMs: 20 })

    const result = await fetchMyHouseholds('/api/v1/households/me', client)

    expect(result).toEqual({ ok: false, reason: 'network' })
    expect(warn).toHaveBeenCalled()
  })

  it('reports a non-JSON gateway error as an http failure without a code', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const client = createApiClient({
      fetch: async () => new Response('<html>bad gateway</html>', { status: 502 }),
    })

    const result = await fetchMyHouseholds('/api/v1/households/me', client)

    expect(result).toEqual({ ok: false, reason: 'http', status: 502, code: null })
    expect(warn).toHaveBeenCalled()
  })

  it('returns no_token without a session', async () => {
    sessionStorage.clear()
    const result = await fetchMyHouseholds('/api/v1/households/me', createApiClient({ fetch: hangingFetch }))
    expect(result).toEqual({ ok: false, reason: 'no_token' })
  })
})
