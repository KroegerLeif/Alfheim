import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/mocks/server'
import { createTestQueryClient, renderWithProviders } from '../../../../tests/test-utils'
import { makeDevice, makeStep } from '../../../../tests/fixtures'
import { DevicesView } from '../DevicesView'

const HOUSEHOLDS = [
  { id: 'hh-1', name: 'Main House', role: 'OWNER' },
  { id: 'hh-2', name: 'Cabin', role: 'MEMBER' },
]

function renderWithDevices(devices: ReturnType<typeof makeDevice>[], locale: 'en' | 'de' | 'pl' = 'en') {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['devices', { householdId: 'hh-1' }], devices)
  return renderWithProviders(<DevicesView />, {
    queryClient,
    locale,
    householdValue: { households: HOUSEHOLDS },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DevicesView', () => {
  it('passes accessibility audit', async () => {
    const { container } = renderWithDevices([makeDevice({ name: 'Boiler' })])
    expect(await axe(container)).toHaveNoViolations()
  })

  it('groups devices by household and puts devices of unknown households last', () => {
    renderWithDevices([
      makeDevice({ name: 'Boiler', household_id: 'hh-1' }),
      makeDevice({ name: 'Stove', household_id: 'hh-2' }),
      makeDevice({ name: 'Mystery Box', household_id: 'hh-elsewhere' }),
    ])

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Main House', 'Cabin', 'Other Locations'])
    expect(screen.getByRole('button', { name: /Mystery Box/ })).toBeInTheDocument()
  })

  it('shows the translated device status and a step count', () => {
    renderWithDevices([
      makeDevice({ name: 'Boiler', status: 'maintenance', steps: [makeStep(), makeStep()] }),
    ])

    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Steps: 2')).toBeInTheDocument()
  })

  it('renders German labels when the locale is German', () => {
    renderWithDevices([makeDevice({ name: 'Boiler', status: 'inactive' })], 'de')

    expect(screen.getByRole('button', { name: 'Gerät hinzufügen' })).toBeInTheDocument()
    expect(screen.getByText('Inaktiv')).toBeInTheDocument()
    expect(screen.getByText('1 Gerät')).toBeInTheDocument()
  })

  it('uses Polish plural forms for the device count', () => {
    renderWithDevices(
      [
        makeDevice({ name: 'A' }),
        makeDevice({ name: 'B' }),
        makeDevice({ name: 'C' }),
        makeDevice({ name: 'D' }),
        makeDevice({ name: 'E' }),
      ],
      'pl'
    )

    expect(screen.getByText('5 urządzeń')).toBeInTheDocument()
  })

  it('shows the empty state when the household has no devices', () => {
    renderWithDevices([])
    expect(screen.getByText('No Devices Found')).toBeInTheDocument()
  })

  it('opens the device detail panel when a card is activated', () => {
    renderWithDevices([makeDevice({ name: 'Boiler', serial: 'SN-BOILER-1' })])

    fireEvent.click(screen.getByRole('button', { name: /Boiler/ }))

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText('SN-BOILER-1')).toBeInTheDocument()
  })

  it('opens and closes the register device wizard', () => {
    renderWithDevices([])

    fireEvent.click(screen.getByRole('button', { name: 'Add Device' }))
    expect(screen.getByText('Register New Device')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])
    expect(screen.queryByText('Register New Device')).not.toBeInTheDocument()
  })

  it('shows a localized error instead of the empty state when loading fails', async () => {
    server.use(http.get('*/devices', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    renderWithProviders(<DevicesView />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load devices or location data. Please refresh or try again later.'
    )
    await waitFor(() => expect(screen.queryByText('No Devices Found')).not.toBeInTheDocument())
  })

  it('keeps very long device names, locations and models inside the card', () => {
    const longName = 'Ultra-Premium-Condensing-Boiler-'.repeat(8)
    const longLocation = 'Basement-Utility-Room-Behind-The-Garage-'.repeat(6)
    const longModel = 'MODEL-' + 'X'.repeat(120)
    renderWithDevices([makeDevice({ name: longName, location: longLocation, model: longModel })])

    const name = screen.getByText(longName)
    expect(name).toHaveClass('truncate')
    expect(screen.getByText(longLocation)).toHaveClass('truncate')
    expect(screen.getByText(`Model: ${longModel}`)).toHaveClass('truncate')

    // Every wrapper between the text and the card must be allowed to shrink for truncation to work.
    const card = screen.getByRole('button', { name: new RegExp(longName.slice(0, 20)) })
    expect(card).toHaveClass('min-w-0')
    expect(card).toHaveClass('overflow-hidden')
  })
})
