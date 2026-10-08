import React from 'react'
import { screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/mocks/server'
import { createTestQueryClient, mockToday, renderWithProviders } from '../../../../tests/test-utils'
import { makeDevice, makeStep } from '../../../../tests/fixtures'
import { MaintenanceView } from '../MaintenanceView'

afterEach(() => {
  vi.useRealTimers()
})

function renderView(devices: ReturnType<typeof makeDevice>[], locale: 'en' | 'de' | 'pl' = 'en') {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['devices', { householdId: 'hh-1' }], devices)
  return renderWithProviders(<MaintenanceView onStartMaintenance={vi.fn()} />, { queryClient, locale })
}

const DEVICES = () => [
  makeDevice({
    name: 'Boiler',
    steps: [makeStep({ supply_needed_date: '2025-06-10' }), makeStep({ supply_needed_date: '2025-06-20' })],
  }),
  makeDevice({ name: 'Fridge', steps: [makeStep({ supply_needed_date: '2025-09-01' })] }),
  makeDevice({ name: 'Heat Pump', steps: [makeStep({ supply_needed_date: null })] }),
]

describe('MaintenanceView', () => {
  it('passes accessibility audit', async () => {
    mockToday(2025, 6, 15)
    const { container } = renderView(DEVICES())
    expect(await axe(container)).toHaveNoViolations()
  })

  it('counts overdue, due soon and ok steps from calendar days', () => {
    mockToday(2025, 6, 15)
    renderView(DEVICES())

    const totals = screen.getAllByRole('button', { pressed: false }).concat(screen.getAllByRole('button', { pressed: true }))
    const read = (label: string) => within(totals.find((b) => b.textContent?.includes(label)) as HTMLElement).getByText(/^\d+$/)
    expect(read('Total Steps')).toHaveTextContent('4')
    expect(read('Overdue')).toHaveTextContent('1')
    expect(read('Due Soon')).toHaveTextContent('1')
    // A step without a due date counts as good, matching the backend summary.
    expect(read('Good')).toHaveTextContent('2')
  })

  it('treats a step due tomorrow as due soon at any local time, not overdue', () => {
    mockToday(2025, 6, 15, 23)
    renderView([makeDevice({ name: 'Boiler', steps: [makeStep({ supply_needed_date: '2025-06-16' })] })])

    expect(screen.getByText('DUE SOON')).toBeInTheDocument()
    expect(screen.queryByText('OVERDUE')).not.toBeInTheDocument()
  })

  it('filters the device list with the metric cards and labels the active filter', () => {
    mockToday(2025, 6, 15)
    renderView(DEVICES())

    fireEvent.click(screen.getByRole('button', { name: /Overdue/ }))

    expect(screen.getByText('Boiler')).toBeInTheDocument()
    expect(screen.queryByText('Fridge')).not.toBeInTheDocument()
    expect(screen.getByText('Showing overdue (1 item)')).toBeInTheDocument()
  })

  it('shows the next service date or a localized placeholder', () => {
    mockToday(2025, 6, 15)
    renderView(DEVICES())

    expect(screen.getByText('Jun 10, 2025')).toBeInTheDocument()
    expect(screen.getByText('Not scheduled')).toBeInTheDocument()
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
  })

  it('renders the dashboard in Polish', () => {
    mockToday(2025, 6, 15)
    renderView(DEVICES(), 'pl')

    expect(screen.getByRole('button', { name: /Zaległe/ })).toBeInTheDocument()
    expect(screen.getByText('Wyświetlanie: wszystkie urządzenia (3 pozycje)')).toBeInTheDocument()
  })

  it.each([
    ['Due Soon', 'due soon', ['Boiler']],
    ['Good', 'in good shape', ['Fridge', 'Heat Pump']],
    ['Total Steps', 'all devices', ['Boiler', 'Fridge', 'Heat Pump']],
  ])('filters by the "%s" card', (card, label, expectedDevices) => {
    mockToday(2025, 6, 15)
    renderView([
      makeDevice({ name: 'Boiler', steps: [makeStep({ supply_needed_date: '2025-06-20' })] }),
      makeDevice({ name: 'Fridge', steps: [makeStep({ supply_needed_date: '2025-09-01' })] }),
      makeDevice({ name: 'Heat Pump', steps: [makeStep({ supply_needed_date: null })] }),
    ])

    fireEvent.click(screen.getByRole('button', { name: new RegExp(card) }))

    expect(screen.getByText(new RegExp(`^Showing ${label} `))).toBeInTheDocument()
    for (const name of ['Boiler', 'Fridge', 'Heat Pump']) {
      if (expectedDevices.includes(name)) expect(screen.getByText(name)).toBeInTheDocument()
      else expect(screen.queryByText(name)).not.toBeInTheDocument()
    }
  })

  it('shows the all clear state when no device matches the filter', () => {
    mockToday(2025, 6, 15)
    renderView([makeDevice({ name: 'Boiler', steps: [makeStep({ supply_needed_date: '2025-09-01' })] })])

    fireEvent.click(screen.getByRole('button', { name: /Overdue/ }))

    expect(screen.getByText('All Clear')).toBeInTheDocument()
  })

  it('starts the maintenance wizard and opens the detail panel from a row', () => {
    mockToday(2025, 6, 15)
    const onStart = vi.fn()
    const device = makeDevice({ name: 'Boiler', steps: [makeStep({ supply_needed_date: '2025-06-10' })] })
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(['devices', { householdId: 'hh-1' }], [device])
    renderWithProviders(<MaintenanceView onStartMaintenance={onStart} />, { queryClient })

    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onStart).toHaveBeenCalledWith(device)

    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
  })

  it('shows a localized error when the devices cannot be loaded', async () => {
    server.use(http.get('*/devices', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    renderWithProviders(<MaintenanceView onStartMaintenance={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load devices or location data.')
  })

  it('keeps long device names and locations on a single truncated line', () => {
    mockToday(2025, 6, 15)
    const longName = 'Industrial-Grade-Heat-Recovery-Ventilation-Unit-'.repeat(5)
    const longLocation = 'Attic-Behind-The-Insulation-'.repeat(8)
    renderView([makeDevice({ name: longName, location: longLocation, model: 'M'.repeat(100), steps: [makeStep()] })])

    expect(screen.getByText(longName)).toHaveClass('truncate')
    expect(screen.getByText(longLocation)).toHaveClass('truncate')
    expect(screen.getByText('M'.repeat(100))).toHaveClass('truncate')
  })
})
