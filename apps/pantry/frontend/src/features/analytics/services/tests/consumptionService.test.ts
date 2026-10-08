import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchConsumptionLedger } from '../consumptionService'
import { mockApi } from '@/tests/mockApi'
import { API, ledgerEntry } from '@/tests/fixtures'

const PATH = `GET ${API}/inventory/transactions`
const START = new Date(2026, 0, 1)

const rows = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, i) => ledgerEntry({ id: `tx${offset + i}`, transaction_type: 'out', quantity: -1 }))

describe('fetchConsumptionLedger', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('pages through the filtered history until the last short page', async () => {
    const api = mockApi({
      [PATH]: ({ search }: { search: URLSearchParams }) => {
        const offset = Number(search.get('offset'))
        return offset === 0 ? rows(100) : offset === 100 ? rows(100, 100) : rows(30, 200)
      },
    })

    const result = await fetchConsumptionLedger(START)

    expect(result.rows).toHaveLength(230)
    expect(result.truncated).toBe(false)
    const calls = api.to(PATH)
    expect(calls.map((c) => c.search.get('offset'))).toEqual(['0', '100', '200'])
    expect(calls[0].search.get('limit')).toBe('100')
    expect(calls[0].search.getAll('transaction_type')).toEqual(['out', 'waste'])
    expect(calls[0].search.get('date_from')).toBe(START.toISOString())
  })

  it('stops after a single request when everything fits on one page', async () => {
    const api = mockApi({ [PATH]: () => rows(3) })

    const result = await fetchConsumptionLedger(START)

    expect(result).toEqual({ rows: expect.any(Array), truncated: false })
    expect(api.to(PATH)).toHaveLength(1)
  })

  it('flags truncation when the safety bound is reached', async () => {
    const api = mockApi({ [PATH]: () => rows(100) })

    const result = await fetchConsumptionLedger(START)

    expect(result.truncated).toBe(true)
    expect(result.rows).toHaveLength(5000)
    expect(api.to(PATH)).toHaveLength(50)
  })
})
