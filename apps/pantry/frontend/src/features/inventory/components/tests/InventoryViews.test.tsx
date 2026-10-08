import { screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardView } from '../DashboardView'
import { InventoryTableView } from '../InventoryTableView'
import { InventoryTableRow } from '../InventoryTableRow'
import { AlertsFeed } from '../AlertsFeed'
import { renderWithProviders } from '@/tests/utils'
import { json, mockApi } from '@/tests/mockApi'
import { API, category, location, lowStock, product, stateLine } from '@/tests/fixtures'

const EMPTY_SUMMARY = { expired: [], valid: [], untracked: [] }

describe('inventory views', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('DashboardView shows the load error in German', async () => {
    mockApi({
      [`GET ${API}/inventory/state`]: () => json(403, { detail: 'nope' }),
      [`GET ${API}/inventory/low-stock`]: [],
      [`GET ${API}/inventory/expiration-summary`]: EMPTY_SUMMARY,
    })
    renderWithProviders(<DashboardView />, { language: 'de' })

    expect(
      await screen.findByText('Das Bestands-Dashboard konnte nicht geladen werden. Bitte aktualisiere die Seite oder versuche es später erneut.')
    ).toBeInTheDocument()
  })

  it('DashboardView renders the KPI cards and the quick actions', async () => {
    mockApi({
      [`GET ${API}/inventory/state`]: [stateLine()],
      [`GET ${API}/inventory/low-stock`]: [lowStock()],
      [`GET ${API}/inventory/expiration-summary`]: EMPTY_SUMMARY,
    })
    renderWithProviders(<DashboardView />)

    expect(await screen.findByText('Stock In (+)')).toBeInTheDocument()
    expect(screen.getByText('Stock Out (-)')).toBeInTheDocument()
    expect(screen.getByText('Low Stock Lines')).toBeInTheDocument()
  })

  it('InventoryTableView shows the load error in Polish', async () => {
    mockApi({
      [`GET ${API}/inventory/state`]: () => json(403, { detail: 'nope' }),
      [`GET ${API}/locations`]: [],
      [`GET ${API}/categories`]: [],
    })
    renderWithProviders(<InventoryTableView />, { language: 'pl' })

    expect(await screen.findByText('Nie udało się wczytać stanów magazynowych.')).toBeInTheDocument()
  })

  it('InventoryTableView filters stock lines by search text and category', async () => {
    mockApi({
      [`GET ${API}/inventory/state`]: [
        stateLine({ id: 's1', product: product({ id: 'p1', name: 'Apples', category_id: 'c1' }), location_id: 'l1' }),
        stateLine({ id: 's2', product: product({ id: 'p2', name: 'Milk', category_id: 'c2' }), location_id: 'l1' }),
      ],
      [`GET ${API}/locations`]: [location({ id: 'l1', name: 'Cellar' })],
      [`GET ${API}/categories`]: [category({ id: 'c1', name: 'Fruits' }), category({ id: 'c2', name: 'Dairy' })],
    })
    renderWithProviders(<InventoryTableView />)
    await screen.findByText('Apples')

    fireEvent.change(screen.getByLabelText('All Categories'), { target: { value: 'c2' } })
    expect(screen.queryByText('Apples')).not.toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()
  })

  it('InventoryTableRow keeps very long names in their cells and formats the expiry for the language', () => {
    const longName = 'Product-name-without-any-break-'.repeat(8)
    renderWithProviders(
      <table>
        <tbody>
          <InventoryTableRow
            state={stateLine({
              expiration_date: '2099-03-05',
              product: product({ name: longName, brand: 'Brand-'.repeat(20) }),
              location: location({ name: 'Location-'.repeat(15) }),
            })}
            onQuickAction={vi.fn()}
          />
        </tbody>
      </table>,
      { language: 'de' }
    )

    expect(screen.getByText(longName)).toHaveClass('break-words')
    expect(screen.getByText(longName).closest('td')).toHaveClass('max-w-[16rem]')
    expect(screen.getByText('5.3.2099')).toBeInTheDocument()
  })

  it('AlertsFeed translates the missing batch label and wraps long names', () => {
    const longName = 'Expiring-product-'.repeat(10)
    renderWithProviders(
      <AlertsFeed
        isLoading={false}
        alertFeed={[{ ...stateLine({ expiration_date: '2020-01-01', batch_code: null, product: product({ name: longName }) }), severity: 'high' }]}
      />,
      { language: 'de' }
    )

    expect(screen.getByText(longName)).toHaveClass('break-words')
    expect(screen.getByText(/Charge: Keine/)).toBeInTheDocument()
    expect(screen.getByText('1.1.2020')).toBeInTheDocument()
  })
})
