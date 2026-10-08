import { screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LedgerHistoryView, LEDGER_PAGE_SIZE } from '../LedgerHistoryView'
import { renderWithProviders } from '@/tests/utils'
import { json, mockApi } from '@/tests/mockApi'
import { API, ledgerEntry, location, product } from '@/tests/fixtures'

const TX = `GET ${API}/inventory/transactions`
const products = [product({ id: 'p1', name: 'Apples' }), product({ id: 'p2', name: 'Milk' })]
const locations = [location({ id: 'l1', name: 'Cellar' }), location({ id: 'l2', name: 'Fridge' })]

/** Serves a ledger of `total` entries, newest first, honouring limit/offset and the product filter. */
function ledgerServer(total: number) {
  const all = Array.from({ length: total }, (_, i) => ledgerEntry({ id: `tx${i}`, product_id: i % 2 ? 'p2' : 'p1', quantity: i + 1 }))
  return ({ search }: { search: URLSearchParams }) => {
    const limit = Number(search.get('limit'))
    const offset = Number(search.get('offset'))
    const productId = search.get('product_id')
    const rows = productId ? all.filter((e) => e.product_id === productId) : all
    return rows.slice(offset, offset + limit)
  }
}

function setup(total: number, extra: Record<string, unknown> = {}) {
  return mockApi({
    [TX]: ledgerServer(total),
    [`GET ${API}/products`]: products,
    [`GET ${API}/locations`]: locations,
    ...extra,
  })
}

describe('LedgerHistoryView', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the first page and fetches one extra row to learn whether older entries exist', async () => {
    const api = setup(60)
    renderWithProviders(<LedgerHistoryView />)

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(LEDGER_PAGE_SIZE + 1)) // header + rows
    const first = api.to(TX)[0]
    expect(first.search.get('limit')).toBe(String(LEDGER_PAGE_SIZE + 1))
    expect(first.search.get('offset')).toBe('0')
    expect(screen.getByRole('button', { name: /Older/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Newer/ })).toBeDisabled()
  })

  it('pages back through the whole history, past the first 100 entries', async () => {
    const api = setup(130)
    renderWithProviders(<LedgerHistoryView />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Older/ })).toBeEnabled())

    for (let page = 1; page <= 5; page++) {
      // The pager is disabled while the next page loads, so wait for it before paging on.
      await waitFor(() => expect(screen.getByRole('button', { name: /Older/ })).toBeEnabled())
      fireEvent.click(screen.getByRole('button', { name: /Older/ }))
      await screen.findByText(`Page ${page + 1}`)
    }
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5 + 1))

    // Page 6 holds entries 126-130, which the old 100-row window could never show.
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5 + 1))
    expect(screen.getByRole('button', { name: /Older/ })).toBeDisabled()
    expect(api.to(TX).map((c) => c.search.get('offset'))).toContain('125')

    fireEvent.click(screen.getByRole('button', { name: /Newer/ }))
    expect(await screen.findByText('Page 5')).toBeInTheDocument()
  })

  it('filters on the server across the full history and returns to the first page', async () => {
    const api = setup(80)
    renderWithProviders(<LedgerHistoryView />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Older/ })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /Older/ }))
    await screen.findByText('Page 2')

    fireEvent.change(screen.getByLabelText('Filter by Product'), { target: { value: 'p2' } })

    await screen.findByText('Page 1')
    await waitFor(() => {
      const last = api.to(TX).at(-1)!
      expect(last.search.get('product_id')).toBe('p2')
      expect(last.search.get('offset')).toBe('0')
    })

    fireEvent.change(screen.getByLabelText('Filter by Location'), { target: { value: 'l1' } })
    await waitFor(() => expect(api.to(TX).at(-1)!.search.get('location_id')).toBe('l1'))
  })

  it('shows localized transaction types and labels', async () => {
    mockApi({
      [TX]: [
        ledgerEntry({ id: 'a', transaction_type: 'waste', quantity: -1 }),
        ledgerEntry({ id: 'b', transaction_type: 'reconciliation', quantity: 2, batch_code: 'lot-1', product_id: 'p1' }),
      ],
      [`GET ${API}/products`]: products,
      [`GET ${API}/locations`]: locations,
    })
    renderWithProviders(<LedgerHistoryView />, { language: 'de' })

    expect(await screen.findByText('Verderb')).toBeInTheDocument()
    expect(screen.getByText('Inventur')).toBeInTheDocument()
    expect(screen.getByText(/Charge: LOT-1/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Marke: Farmer/).length).toBeGreaterThan(0)
  })

  it('shows the load error in the active language instead of English', async () => {
    setup(0, { [TX]: () => json(403, { detail: 'nope' }) })
    renderWithProviders(<LedgerHistoryView />, { language: 'pl' })

    expect(await screen.findByText('Nie udało się wczytać zapisów dziennika operacji.')).toBeInTheDocument()
  })

  it('keeps very long product names, locations and notes inside their cells', async () => {
    const longName = 'Product-name-with-no-breaks-'.repeat(8)
    const longNotes = 'a very long note '.repeat(40).trim()
    mockApi({
      [TX]: [ledgerEntry({ id: 'a', notes: longNotes, batch_code: 'B'.repeat(80) })],
      [`GET ${API}/products`]: [product({ id: 'p1', name: longName })],
      [`GET ${API}/locations`]: [location({ id: 'l1', name: 'Location-'.repeat(20) })],
    })
    renderWithProviders(<LedgerHistoryView />)

    const nameCell = (await screen.findByText(new RegExp(longName.slice(0, 20)))).closest('td')!
    expect(nameCell).toHaveClass('break-words')
    expect(screen.getByTitle(longNotes)).toHaveClass('break-words', 'line-clamp-3')
    expect(screen.getByTitle('B'.repeat(80))).toHaveClass('truncate', 'max-w-full')
  })
})
