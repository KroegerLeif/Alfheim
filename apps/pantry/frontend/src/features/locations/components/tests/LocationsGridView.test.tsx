import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocationsGridView } from '../LocationsGridView'
import { renderWithProviders } from '@/tests/utils'
import { json, mockApi } from '@/tests/mockApi'
import { API, location, lowStock, stateLine } from '@/tests/fixtures'

const locations = [
  location({ id: 'loc-1', name: 'Keller Shelf A', description: 'Cold basement shelf' }),
  location({ id: 'loc-2', name: 'Fridge K1', description: 'Kitchen refrigerator', is_system: true }),
  location({ id: 'loc-3', name: 'Pantry Rack', description: 'Dry goods storage' }),
]

const states = [
  // loc-1 holds one expired line
  stateLine({ id: 's1', product_id: 'p1', location_id: 'loc-1', quantity: 2, expiration_date: '2020-01-01' }),
  // loc-2 holds the product that is below its minimum
  stateLine({ id: 's2', product_id: 'p2', location_id: 'loc-2', quantity: 1, expiration_date: '2099-12-31' }),
  // loc-3 has no issues
  stateLine({ id: 's3', product_id: 'p3', location_id: 'loc-3', quantity: 10, expiration_date: '2099-12-31' }),
]

describe('LocationsGridView', () => {
  afterEach(() => vi.unstubAllGlobals())

  function api(extra: Record<string, unknown> = {}) {
    return mockApi({
      [`GET ${API}/locations`]: locations,
      [`GET ${API}/inventory/state`]: states,
      [`GET ${API}/inventory/low-stock`]: [lowStock({ id: 'p2', name: 'Milk' }, 1)],
      ...extra,
    })
  }

  it('renders the title and the storage location cards', async () => {
    api()
    renderWithProviders(<LocationsGridView />)

    expect(screen.getByRole('heading', { name: 'Storage Locations' })).toBeInTheDocument()
    expect(await screen.findByText('Keller Shelf A')).toBeInTheDocument()
    expect(screen.getByText('Cold basement shelf')).toBeInTheDocument()
    expect(screen.getByText('Fridge K1')).toBeInTheDocument()
    expect(screen.getByText('System Fallback')).toBeInTheDocument()
  })

  it('shows the alarm badges for each card in the active language', async () => {
    api()
    renderWithProviders(<LocationsGridView />, { language: 'de' })

    expect(await screen.findByText(/1 MHD/)).toBeInTheDocument()
    expect(screen.getByText(/1 knapp/)).toBeInTheDocument()
    expect(screen.getByText('✓ OK')).toBeInTheDocument()
  })

  it('labels the alarm badges in English and Polish instead of German abbreviations', async () => {
    api()
    const english = renderWithProviders(<LocationsGridView />)
    expect(await english.findByText('1 expired')).toBeInTheDocument()
    expect(english.getByText('1 low')).toBeInTheDocument()
    english.unmount()

    const polish = renderWithProviders(<LocationsGridView />, { language: 'pl' })
    expect(await polish.findByText('1 po terminie')).toBeInTheDocument()
    expect(polish.getByText('1 mało')).toBeInTheDocument()
  })

  it('toggles the inline creation form', async () => {
    api()
    renderWithProviders(<LocationsGridView />)
    await screen.findByText('Keller Shelf A')

    expect(screen.queryByLabelText(/Location Name/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /CREATE NEW LOCATION/ }))
    expect(screen.getByLabelText(/Location Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /CANCEL/ }))
    expect(screen.queryByLabelText(/Location Name/)).not.toBeInTheDocument()
  })

  it('creates a location and confirms it', async () => {
    const mock = api({ [`POST ${API}/locations`]: () => json(201, location({ id: 'loc-4', name: 'Cabinet B' })) })
    renderWithProviders(<LocationsGridView />)
    await screen.findByText('Keller Shelf A')

    fireEvent.click(screen.getByRole('button', { name: /CREATE NEW LOCATION/ }))
    fireEvent.change(screen.getByLabelText(/Location Name/), { target: { value: 'Cabinet B' } })
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'High cabinet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Location' }))

    await waitFor(() => expect(mock.to(`POST ${API}/locations`)).toHaveLength(1))
    expect(mock.to(`POST ${API}/locations`)[0].body).toEqual({ name: 'Cabinet B', description: 'High cabinet' })
    expect(await screen.findByText('Storage location created successfully.')).toBeInTheDocument()
  })

  it('shows the server reason and keeps the input when creating a location fails', async () => {
    api({ [`POST ${API}/locations`]: () => json(400, { detail: 'Failed to create location: duplicate' }) })
    renderWithProviders(<LocationsGridView />)
    await screen.findByText('Keller Shelf A')

    fireEvent.click(screen.getByRole('button', { name: /CREATE NEW LOCATION/ }))
    fireEvent.change(screen.getByLabelText(/Location Name/), { target: { value: 'Cabinet B' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Location' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to create location: duplicate')
    expect(screen.getByLabelText(/Location Name/)).toHaveValue('Cabinet B')
  })

  it('shows the load error in German instead of English', async () => {
    mockApi({
      [`GET ${API}/locations`]: () => json(403, { detail: 'nope' }),
      [`GET ${API}/inventory/state`]: states,
      [`GET ${API}/inventory/low-stock`]: [],
    })
    renderWithProviders(<LocationsGridView />, { language: 'de' })

    expect(
      await screen.findByText('Lagerorte oder Bestandsdaten konnten nicht geladen werden. Bitte aktualisiere die Seite oder versuche es später erneut.')
    ).toBeInTheDocument()
  })

  it('protects the system location from edit and delete', async () => {
    api()
    renderWithProviders(<LocationsGridView />)
    await screen.findByText('Fridge K1')

    expect(screen.getByRole('button', { name: 'Edit location: Keller Shelf A' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit location: Fridge K1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete location: Fridge K1' })).not.toBeInTheDocument()
  })

  it('edits a location through the dialog', async () => {
    const mock = api({
      [`PATCH ${API}/locations/loc-1`]: () => json(200, location({ id: 'loc-1', name: 'Cellar' })),
    })
    renderWithProviders(<LocationsGridView />)
    await screen.findByText('Keller Shelf A')

    fireEvent.click(screen.getByRole('button', { name: 'Edit location: Keller Shelf A' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Location Name/), { target: { value: 'Cellar' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(mock.to(`PATCH ${API}/locations/loc-1`)).toHaveLength(1))
    expect(mock.to(`PATCH ${API}/locations/loc-1`)[0].body).toEqual({ name: 'Cellar', description: 'Cold basement shelf' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('deletes an empty location after confirmation', async () => {
    const mock = api({ [`DELETE ${API}/locations/loc-3`]: () => new Response(null, { status: 204 }) })
    renderWithProviders(<LocationsGridView />)
    await screen.findByText('Pantry Rack')

    fireEvent.click(screen.getByRole('button', { name: 'Delete location: Pantry Rack' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete this storage location permanently?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(mock.to(`DELETE ${API}/locations/loc-3`)).toHaveLength(1))
  })

  it('explains a location_in_use conflict in the active language', async () => {
    api({
      [`DELETE ${API}/locations/loc-1`]: () =>
        json(409, { detail: { code: 'location_in_use', message: 'in use', item_count: 3 } }),
    })
    renderWithProviders(<LocationsGridView />, { language: 'de' })
    await screen.findByText('Keller Shelf A')

    fireEvent.click(screen.getByRole('button', { name: 'Lagerort löschen: Keller Shelf A' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'In diesem Lagerort liegt noch Bestand oder er kommt in den Buchungen vor (3 Einträge). Er kann nicht gelöscht werden.'
    )
  })

  it('keeps long names and descriptions inside the card', async () => {
    const longName = 'Very-long-location-name-'.repeat(8)
    const longDescription = 'Notes about this shelf '.repeat(40).trim()
    api({ [`GET ${API}/locations`]: [location({ id: 'loc-9', name: longName, description: longDescription })] })
    renderWithProviders(<LocationsGridView />)

    const heading = await screen.findByRole('heading', { name: longName })
    expect(heading).toHaveClass('truncate', 'min-w-0')
    expect(heading).toHaveAttribute('title', longName)
    expect(screen.getByTitle(longDescription)).toHaveClass('line-clamp-2', 'break-words')
  })
})

