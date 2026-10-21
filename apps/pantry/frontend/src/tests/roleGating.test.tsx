import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CategoryManager } from '@/features/categories/components/CategoryManager'
import { LocationsGridView } from '@/features/locations/components/LocationsGridView'
import { renderWithProviders } from '@/tests/utils'
import { mockApi } from '@/tests/mockApi'
import { API, category, location } from '@/tests/fixtures'

function renderAll(role: string) {
  mockApi({
    [`GET ${API}/categories`]: [category({ id: 'c1', name: 'Baking' })],
    [`GET ${API}/locations`]: [location({ id: 'loc-1', name: 'Keller Shelf A' })],
    [`GET ${API}/inventory/state`]: [],
    [`GET ${API}/inventory/low-stock`]: [],
  })
  return renderWithProviders(
    <>
      <CategoryManager />
      <LocationsGridView />
    </>,
    { role }
  )
}

async function loaded() {
  await screen.findByText('Baking')
  await screen.findByText('Keller Shelf A')
}

const ADMIN_DELETES = ['Delete category: Baking', 'Delete location: Keller Shelf A']

describe('household role gating', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('GUEST sees no create, rename or delete controls', async () => {
    renderAll('GUEST')
    await loaded()
    expect(screen.queryByLabelText('Category Name')).toBeNull()
    expect(document.getElementById('toggle-create-location')).toBeNull()
    expect(screen.queryByRole('button', { name: /^(Rename|Edit) / })).toBeNull()
    for (const name of ADMIN_DELETES) expect(screen.queryByRole('button', { name })).toBeNull()
  })

  it('MEMBER can create and rename but deletes are disabled with a hint', async () => {
    renderAll('MEMBER')
    await loaded()
    expect(screen.getByLabelText('Category Name')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Rename category: Baking' })).toBeEnabled()
    for (const name of ADMIN_DELETES) {
      const button = screen.getByRole('button', { name })
      expect(button).toBeDisabled()
      expect(button.closest('[title]')).toHaveAttribute('title', expect.stringMatching(/admins and owners/))
    }
  })

  it('ADMIN gets every delete enabled', async () => {
    renderAll('ADMIN')
    await loaded()
    for (const name of ADMIN_DELETES) expect(screen.getByRole('button', { name })).toBeEnabled()
    expect(screen.queryByTestId('permission-hint')).toBeNull()
  })
})
