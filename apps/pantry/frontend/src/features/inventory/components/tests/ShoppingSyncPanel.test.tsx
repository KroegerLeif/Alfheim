import { screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShoppingSyncPanel } from '../ShoppingSyncPanel'
import { renderWithProviders } from '@/tests/utils'
import { json, mockApi } from '@/tests/mockApi'
import { lowStock } from '@/tests/fixtures'

const ITEMS_PATH = 'POST /shopping/api/v1/shopping/items'
const items = [
  lowStock({ id: 'p1', name: 'Milk' }, 1),
  lowStock({ id: 'p2', name: 'Eggs' }, 2),
  lowStock({ id: 'p3', name: 'Rice' }, 0),
]

describe('ShoppingSyncPanel', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists the quota violations and disables the export when nothing is low', () => {
    renderWithProviders(<ShoppingSyncPanel isLoading={false} lowStockItems={[]} />)

    expect(screen.getByText('[ ALL QUOTAS SATISFIED ]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Export to Shopping App/ })).toBeDisabled()
  })

  it('shows how many items were sent when everything arrives', async () => {
    mockApi({ [ITEMS_PATH]: () => json(201, {}) })
    renderWithProviders(<ShoppingSyncPanel isLoading={false} lowStockItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /Export to Shopping App/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Items sent to the shopping app: 3')
  })

  it('does not report success when only some items arrive, and names the missing ones', async () => {
    mockApi({
      [ITEMS_PATH]: ({ body }: { body: unknown }) =>
        (body as { name: string }).name === 'Eggs' ? json(422, { detail: 'rejected' }) : json(201, {}),
    })
    renderWithProviders(<ShoppingSyncPanel isLoading={false} lowStockItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /Export to Shopping App/ }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Sent: 2, not sent: 1')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // The failed item stays visible in the result list (in addition to the quota list above).
    expect(screen.getAllByText('Eggs').length).toBeGreaterThan(1)
    expect(screen.getByRole('button', { name: 'Retry failed items' })).toBeEnabled()
  })

  it('retries only the failed items and then reports the combined result', async () => {
    let eggsAttempts = 0
    const api = mockApi({
      [ITEMS_PATH]: ({ body }: { body: unknown }) => {
        if ((body as { name: string }).name !== 'Eggs') return json(201, {})
        eggsAttempts += 1
        return eggsAttempts === 1 ? json(503, { detail: 'down' }) : json(201, {})
      },
    })
    renderWithProviders(<ShoppingSyncPanel isLoading={false} lowStockItems={items} />)

    fireEvent.click(screen.getByRole('button', { name: /Export to Shopping App/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry failed items' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Items sent to the shopping app: 3')
    // 3 on the first run plus only the single failed item on the retry.
    expect(api.to(ITEMS_PATH)).toHaveLength(4)
  })

  it('reports a complete failure instead of silently reverting', async () => {
    mockApi({ [ITEMS_PATH]: () => json(403, { detail: 'nope' }) })
    renderWithProviders(<ShoppingSyncPanel isLoading={false} lowStockItems={items} />, { language: 'de' })

    fireEvent.click(screen.getByRole('button', { name: 'An Einkaufs-App senden' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Kein Artikel konnte an die Einkaufs-App gesendet werden (3 fehlgeschlagen)')
    )
  })

  it('truncates very long product names in the quota list', () => {
    const longName = 'Extra-long-product-name-'.repeat(10)
    renderWithProviders(<ShoppingSyncPanel isLoading={false} lowStockItems={[lowStock({ id: 'p9', name: longName }, 1)]} />)

    const name = screen.getByText(longName)
    expect(name).toHaveClass('truncate', 'min-w-0')
    expect(name).toHaveAttribute('title', longName)
  })
})
