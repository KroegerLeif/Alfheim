import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/mocks/server'
import { createTestQueryClient, mockToday, renderWithProviders } from '../../../../tests/test-utils'
import { makeDevice, makeStep } from '../../../../tests/fixtures'
import { ScheduledView } from '../ScheduledView'

afterEach(() => {
  vi.useRealTimers()
})

function renderView(devices: ReturnType<typeof makeDevice>[], locale: 'en' | 'de' | 'pl' = 'en') {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['devices', { householdId: 'hh-1' }], devices)
  return renderWithProviders(<ScheduledView />, { queryClient, locale })
}

const DEVICES = () => [
  makeDevice({
    name: 'Boiler',
    location: 'Basement',
    steps: [
      makeStep({ title: 'Far task', supply_needed_date: '2025-12-01' }),
      makeStep({ title: 'Late task', supply_needed_date: '2025-06-10' }),
      makeStep({ title: 'Edge task', supply_needed_date: '2025-07-15' }),
      makeStep({ title: 'Unplanned task', supply_needed_date: null }),
    ],
  }),
  makeDevice({ name: 'Fridge', location: 'Kitchen', steps: [makeStep({ title: 'Soon task', supply_needed_date: '2025-06-20' })] }),
]

const taskTitles = () => screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)

describe('ScheduledView', () => {
  it('passes accessibility audit', async () => {
    mockToday(2025, 6, 15)
    const { container } = renderView(DEVICES())
    expect(await axe(container)).toHaveNoViolations()
  })

  it('lists upcoming tasks (overdue and within 30 days) in due-date order by default', () => {
    mockToday(2025, 6, 15)
    renderView(DEVICES())

    // 2025-07-15 is exactly 30 days away and still upcoming; December and unscheduled tasks are not.
    expect(taskTitles()).toEqual(['Late task', 'Soon task', 'Edge task'])
    expect(screen.getByRole('button', { name: 'Upcoming (30d)', pressed: true })).toBeInTheDocument()
  })

  it('shows every task, unscheduled ones last, under "All Tasks"', () => {
    mockToday(2025, 6, 15)
    renderView(DEVICES())

    fireEvent.click(screen.getByRole('button', { name: 'All Tasks' }))

    expect(taskTitles()).toEqual(['Late task', 'Soon task', 'Edge task', 'Far task', 'Unplanned task'])
  })

  it('does not call an unscheduled task due soon or overdue', () => {
    mockToday(2025, 6, 15)
    renderView(DEVICES())
    fireEvent.click(screen.getByRole('button', { name: 'All Tasks' }))

    const row = screen.getByText('Unplanned task').closest('button') as HTMLElement
    expect(row).toHaveTextContent('Not scheduled')
    expect(row).not.toHaveTextContent(/overdue|due soon|good/i)
  })

  it('shows the empty state when nothing is upcoming', () => {
    mockToday(2025, 6, 15)
    renderView([makeDevice({ steps: [makeStep({ supply_needed_date: '2026-01-01' })] })])

    expect(screen.getByText('No Tasks Scheduled')).toBeInTheDocument()
  })

  it('renders in German', () => {
    mockToday(2025, 6, 15)
    renderView(DEVICES(), 'de')

    expect(screen.getByRole('button', { name: 'Demnächst (30T)' })).toBeInTheDocument()
    expect(screen.getByText('ÜBERFÄLLIG (5T)')).toBeInTheDocument()
  })

  it('shows a localized error instead of the empty state when loading fails', async () => {
    server.use(http.get('*/devices', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    renderWithProviders(<ScheduledView />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load devices or location data.')
    expect(screen.queryByText('No Tasks Scheduled')).not.toBeInTheDocument()
  })
})
