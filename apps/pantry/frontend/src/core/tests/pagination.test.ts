import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAllPages } from '../pagination'
import { mockApi } from '@/tests/mockApi'
import { API } from '@/tests/fixtures'

const PATH = `GET ${API}/products`
const page = (count: number, start = 0) => Array.from({ length: count }, (_, i) => ({ id: start + i }))

describe('fetchAllPages', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('concatenates pages until a short page and sends limit and offset', async () => {
    const api = mockApi({
      [PATH]: ({ search }: { search: URLSearchParams }) =>
        search.get('offset') === '0' ? page(100) : page(40, 100),
    })

    const rows = await fetchAllPages<{ id: number }>('api/v1/products')

    expect(rows).toHaveLength(140)
    expect(api.to(PATH).map((c) => [c.search.get('limit'), c.search.get('offset')])).toEqual([
      ['100', '0'],
      ['100', '100'],
    ])
  })

  it('treats a null body as an empty list', async () => {
    mockApi({ [PATH]: () => new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }) })
    expect(await fetchAllPages('api/v1/products')).toEqual([])
  })
})
