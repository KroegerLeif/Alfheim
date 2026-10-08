import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_ACCESS_TOKEN_KEY } from '@alfheim/shared'
import { pushLowStockToShopping } from '../shoppingExport'
import { json, mockApi } from '@/tests/mockApi'
import { lowStock } from '@/tests/fixtures'

const ITEMS_PATH = 'POST /shopping/api/v1/shopping/items'

describe('pushLowStockToShopping', () => {
  beforeEach(() => {
    sessionStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, 'token-123')
    localStorage.setItem('alfheim_active_household_id', 'hh-7')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('posts every item to the public shopping API with the bearer token and household header', async () => {
    const api = mockApi({ [ITEMS_PATH]: () => json(201, { id: 'new' }) })

    const result = await pushLowStockToShopping([
      lowStock({ id: 'p1', name: 'Milk', brand: 'Dairy', barcode: '4001', base_unit: 'ml', minimum_stock: 1000 }, 250),
      lowStock({ id: 'p2', name: 'Eggs', brand: null, barcode: null, base_unit: 'piece', minimum_stock: 6 }, 5.5),
    ])

    expect(result.failed).toEqual([])
    expect(result.sent.map((item) => item.product.id)).toEqual(['p1', 'p2'])
    const calls = api.to(ITEMS_PATH)
    expect(calls).toHaveLength(2)
    expect(calls[0].headers.get('Authorization')).toBe('Bearer token-123')
    expect(calls[0].headers.get('X-Household-ID')).toBe('hh-7')
    expect(calls.map((c) => c.body)).toEqual([
      { name: 'Milk', brand: 'Dairy', barcode: '4001', quantity: 750, unit: 'ml', product_id: 'p1' },
      // The missing amount is below one unit, so at least one is requested.
      { name: 'Eggs', brand: null, barcode: null, quantity: 1, unit: 'piece', product_id: 'p2' },
    ])
  })

  it('never uses the path the shopping backend does not serve', async () => {
    const api = mockApi({ [ITEMS_PATH]: () => json(201, {}) })

    await pushLowStockToShopping([lowStock({ id: 'p1' })])

    expect(api.calls.map((c) => c.path)).toEqual(['/shopping/api/v1/shopping/items'])
  })

  it('reports rejected items without blocking the others', async () => {
    mockApi({
      [ITEMS_PATH]: ({ body }: { body: unknown }) =>
        (body as { name: string }).name === 'Eggs' ? json(422, { detail: 'rejected' }) : json(201, {}),
    })

    const result = await pushLowStockToShopping([
      lowStock({ id: 'p1', name: 'Milk' }),
      lowStock({ id: 'p2', name: 'Eggs' }),
      lowStock({ id: 'p3', name: 'Rice' }),
    ])

    expect(result.sent.map((item) => item.product.name)).toEqual(['Milk', 'Rice'])
    expect(result.failed.map((item) => item.product.name)).toEqual(['Eggs'])
  })

  it('reports every item as failed when the shopping API is unreachable', async () => {
    mockApi({
      [ITEMS_PATH]: () => {
        throw new TypeError('Failed to fetch')
      },
    })

    const result = await pushLowStockToShopping([lowStock({ id: 'p1' }), lowStock({ id: 'p2', name: 'Eggs' })])

    expect(result.sent).toEqual([])
    expect(result.failed).toHaveLength(2)
  })

  it('sends nothing for an empty list', async () => {
    const api = mockApi({})
    expect(await pushLowStockToShopping([])).toEqual({ sent: [], failed: [] })
    expect(api.calls).toHaveLength(0)
  })
})
