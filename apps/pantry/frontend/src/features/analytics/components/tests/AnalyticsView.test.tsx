import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsView } from '../AnalyticsView'
import { renderWithProviders } from '@/tests/utils'
import { json, mockApi } from '@/tests/mockApi'
import { API, category, ledgerEntry, product, stateLine } from '@/tests/fixtures'

const categories = [category({ id: 'cat-1', name: 'Fruits' }), category({ id: 'cat-2', name: 'Dairy' })]
const states = [
  stateLine({ id: 's1', quantity: 10, product: product({ category_id: 'cat-1' }) }),
  stateLine({ id: 's2', quantity: 5, product: product({ category_id: 'cat-2' }) }),
  stateLine({ id: 's3', quantity: 2.5, product: product({ category_id: 'cat-1' }) }),
  stateLine({ id: 's4', quantity: 1, product: product({ category_id: null }) }),
]

function routes(ledger: unknown, extra: Record<string, unknown> = {}) {
  return {
    [`GET ${API}/inventory/state`]: states,
    [`GET ${API}/categories`]: categories,
    [`GET ${API}/inventory/transactions`]: ledger,
    ...extra,
  }
}

describe('AnalyticsView', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the title and both chart headers', async () => {
    mockApi(routes([]))
    renderWithProviders(<AnalyticsView />)

    expect(await screen.findByText('Consumption per Month')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Performance Analytics' })).toBeInTheDocument()
    expect(screen.getByText('Current Stock by Category')).toBeInTheDocument()
  })

  it('aggregates the current stock per category', async () => {
    mockApi(routes([]))
    renderWithProviders(<AnalyticsView />)

    expect(await screen.findByText('FRUITS')).toBeInTheDocument()
    expect(screen.getByText('12.5 Items')).toBeInTheDocument() // 10 + 2.5
    expect(screen.getByText('DAIRY')).toBeInTheDocument()
    expect(screen.getByText('5 Items')).toBeInTheDocument()
    expect(screen.getByText('UNCATEGORIZED')).toBeInTheDocument()
  })

  it('requests the whole six month window from the server, not only the latest rows', async () => {
    const api = mockApi(routes([]))
    renderWithProviders(<AnalyticsView />)
    await screen.findByText('FRUITS')

    const call = api.to(`GET ${API}/inventory/transactions`)[0]
    expect(call.search.getAll('transaction_type')).toEqual(['out', 'waste'])
    const from = new Date(call.search.get('date_from') as string)
    const now = new Date()
    expect(from.getTime()).toBe(new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime())
  })

  it('draws bars from the stored negative consumption quantities', async () => {
    const now = new Date()
    const previous = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12)
    mockApi(
      routes([
        ledgerEntry({ id: 'a', transaction_type: 'out', quantity: -5, created_at: now.toISOString() }),
        ledgerEntry({ id: 'b', transaction_type: 'waste', quantity: -2, created_at: previous.toISOString() }),
      ])
    )
    renderWithProviders(<AnalyticsView />)

    await screen.findByText('FRUITS')
    expect(screen.queryByText('No ledger audit history available to calculate consumption.')).not.toBeInTheDocument()
    expect(screen.getByText('Scale: Max 5')).toBeInTheDocument()
    expect(screen.getByText(now.toLocaleString('en', { month: 'short' }).toUpperCase())).toBeInTheDocument()
  })

  it('renders the empty placeholders when there is no data', async () => {
    mockApi(routes([], { [`GET ${API}/inventory/state`]: [] }))
    renderWithProviders(<AnalyticsView />)

    expect(await screen.findByText('No ledger audit history available to calculate consumption.')).toBeInTheDocument()
    expect(screen.getByText('No inventory stock items found.')).toBeInTheDocument()
  })

  it('tells the user when the analytics data could not be loaded, in their language', async () => {
    mockApi(routes(() => json(403, { detail: 'nope' })))
    renderWithProviders(<AnalyticsView />, { language: 'pl' })

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się wczytać danych analitycznych.')
    )
  })

  it('warns when the safety bound cut the consumption history short', async () => {
    const page = Array.from({ length: 100 }, (_, i) => ledgerEntry({ id: `tx${i}`, transaction_type: 'out', quantity: -1 }))
    mockApi(routes(() => page))
    renderWithProviders(<AnalyticsView />)

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      'The chart only covers the most recent consumption records.'
    )
  })
})
