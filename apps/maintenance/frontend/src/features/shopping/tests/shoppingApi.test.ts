import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { LEGACY_ACCESS_TOKEN_KEY } from '@alfheim/shared'
import { server } from '../../../tests/mocks/server'
import { sendCartToShopping } from '../api/shoppingApi'

interface Captured {
  url: string
  authorization: string | null
  household: string | null
  body: unknown
}

describe('sendCartToShopping', () => {
  let calls: Captured[]

  beforeEach(() => {
    calls = []
    sessionStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, 'token-123')
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
  })

  const capture = (failFor: string[] = []) =>
    http.post('*/shopping/api/v1/shopping/items', async ({ request }) => {
      const body = (await request.json()) as { name: string }
      calls.push({
        url: request.url,
        authorization: request.headers.get('Authorization'),
        household: request.headers.get('X-Household-ID'),
        body,
      })
      return failFor.includes(body.name)
        ? HttpResponse.json({ detail: 'rejected' }, { status: 422 })
        : HttpResponse.json({ id: 'new' }, { status: 201 })
    })

  it('posts each part to the public shopping API with the bearer token and household header', async () => {
    server.use(capture())

    const result = await sendCartToShopping(['HEPA Filter', 'Gasket'])

    expect(result).toEqual({ sent: ['HEPA Filter', 'Gasket'], failed: [] })
    expect(calls).toHaveLength(2)
    expect(new URL(calls[0].url).pathname).toBe('/shopping/api/v1/shopping/items')
    expect(calls[0].authorization).toBe('Bearer token-123')
    expect(calls[0].household).toBe('hh-7')
    expect(calls.map((c) => c.body)).toEqual([
      { name: 'HEPA Filter', quantity: 1, unit: 'piece' },
      { name: 'Gasket', quantity: 1, unit: 'piece' },
    ])
  })

  it('reports rejected parts without blocking the others', async () => {
    server.use(capture(['Gasket']))

    const result = await sendCartToShopping(['HEPA Filter', 'Gasket', 'Hose'])

    expect(result).toEqual({ sent: ['HEPA Filter', 'Hose'], failed: ['Gasket'] })
    expect(calls).toHaveLength(3)
  })

  it('reports every part as failed when the shopping API is unreachable', async () => {
    server.use(http.post('*/shopping/api/v1/shopping/items', () => HttpResponse.error()))

    const result = await sendCartToShopping(['HEPA Filter'])

    expect(result).toEqual({ sent: [], failed: ['HEPA Filter'] })
  })

  it('sends nothing for an empty cart', async () => {
    server.use(capture())
    expect(await sendCartToShopping([])).toEqual({ sent: [], failed: [] })
    expect(calls).toHaveLength(0)
  })
})
