import { describe, expect, it } from 'vitest'
import { bucketMonthlyConsumption, consumptionWindowStart, lastMonths } from '../consumption'
import { ledgerEntry } from '@/tests/fixtures'

const NOW = new Date(2026, 5, 15, 12) // 15 June 2026, local time

describe('consumption buckets', () => {
  it('covers the current month and the five before it, oldest first', () => {
    expect(lastMonths(NOW, 'en').map((m) => m.key)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    ])
    expect(consumptionWindowStart(NOW)).toEqual(new Date(2026, 0, 1))
  })

  it('labels the months in the active language', () => {
    expect(lastMonths(NOW, 'en').at(-1)?.label).toBe('JUN')
    expect(lastMonths(NOW, 'de').at(-3)?.label).toBe('APR')
    expect(lastMonths(NOW, 'pl').at(-1)?.label).toBe('CZE')
  })

  it('sums the magnitude of the negative OUT and WASTE quantities per local month', () => {
    const rows = [
      ledgerEntry({ id: '1', transaction_type: 'out', quantity: -5, created_at: new Date(2026, 5, 2, 9).toISOString() }),
      ledgerEntry({ id: '2', transaction_type: 'waste', quantity: -2.25, created_at: new Date(2026, 5, 3, 9).toISOString() }),
      ledgerEntry({ id: '3', transaction_type: 'out', quantity: -4, created_at: new Date(2026, 4, 31, 23, 30).toISOString() }),
    ]

    const data = bucketMonthlyConsumption(rows, NOW, 'en')

    expect(data.at(-1)).toEqual({ label: 'JUN', value: 7.3 })
    expect(data.at(-2)).toEqual({ label: 'MAY', value: 4 })
  })

  it('ignores IN and reconciliation rows and rows outside the window', () => {
    const rows = [
      ledgerEntry({ id: '1', transaction_type: 'in', quantity: 20, created_at: new Date(2026, 5, 2).toISOString() }),
      ledgerEntry({ id: '2', transaction_type: 'reconciliation', quantity: -3, created_at: new Date(2026, 5, 2).toISOString() }),
      ledgerEntry({ id: '3', transaction_type: 'out', quantity: -9, created_at: new Date(2025, 11, 31).toISOString() }),
    ]

    expect(bucketMonthlyConsumption(rows, NOW, 'en').every((bucket) => bucket.value === 0)).toBe(true)
  })

  it('counts every row of a busy period, well beyond one hundred entries', () => {
    const rows = Array.from({ length: 250 }, (_, i) =>
      ledgerEntry({ id: `tx${i}`, transaction_type: 'out', quantity: -1, created_at: new Date(2026, i % 6, 10).toISOString() })
    )

    const total = bucketMonthlyConsumption(rows, NOW, 'en').reduce((sum, bucket) => sum + bucket.value, 0)

    expect(total).toBe(250)
  })
})
