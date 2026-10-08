import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { createTestQueryClient, mockToday, renderWithProviders } from '../../../tests/test-utils'
import { makeDevice, makeStep } from '../../../tests/fixtures'
import { Header } from '../Header'
import { useLayout } from '../LayoutContext'

afterEach(() => {
  vi.useRealTimers()
})

function ActiveNav() {
  return <output data-testid="active-nav">{useLayout().activeNav}</output>
}

function renderHeader(devices: ReturnType<typeof makeDevice>[], locale: 'en' | 'de' | 'pl' = 'en') {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(['devices', { householdId: 'hh-1' }], devices)
  return renderWithProviders(
    <>
      <Header />
      <ActiveNav />
    </>,
    { queryClient, locale }
  )
}

describe('Header notifications', () => {
  it('shows the page title for the active navigation entry', () => {
    renderHeader([])
    expect(screen.getByText('Device Inventory')).toBeInTheDocument()
  })

  it('uses only existing translation keys when the menu is empty', () => {
    renderHeader([])

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    expect(screen.getByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('lists overdue and due-soon steps, most overdue first, and marks the bell', async () => {
    mockToday(2025, 6, 15)
    const { container } = renderHeader([
      makeDevice({
        name: 'Boiler',
        steps: [
          makeStep({ title: 'Flush tank', supply_needed_date: '2025-06-16' }),
          makeStep({ title: 'Check anode', supply_needed_date: '2025-06-14' }),
          makeStep({ title: 'Yearly service', supply_needed_date: '2026-06-01' }),
        ],
      }),
    ])

    const bell = screen.getByRole('button', { name: 'Notifications' })
    expect(bell.querySelector('.animate-pulse')).not.toBeNull()
    fireEvent.click(bell)

    const items = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(items).toEqual([
      'Check anode (Boiler) is overdue by 1 day',
      'Flush tank (Boiler) is due tomorrow',
    ])
    expect(screen.getByText('2 Urgent')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('has no alert dot when nothing needs attention', () => {
    mockToday(2025, 6, 15)
    renderHeader([makeDevice({ steps: [makeStep({ supply_needed_date: '2026-06-01' })] })])
    expect(screen.getByRole('button', { name: 'Notifications' }).querySelector('.animate-pulse')).toBeNull()
  })

  it('opens the scheduled tasks when an alert is chosen', () => {
    mockToday(2025, 6, 15)
    renderHeader([makeDevice({ name: 'Boiler', steps: [makeStep({ title: 'Check anode', supply_needed_date: '2025-06-14' })] })])

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    fireEvent.click(screen.getByRole('button', { name: /Check anode/ }))

    expect(screen.getByTestId('active-nav')).toHaveTextContent('scheduled')
    expect(screen.queryByText('All caught up')).not.toBeInTheDocument()
  })

  it('closes the menu when clicking outside', () => {
    renderHeader([])
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByText('No notifications')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByText('No notifications')).not.toBeInTheDocument()
  })

  it('translates the alerts to German and Polish', () => {
    mockToday(2025, 6, 15)
    const devices = [makeDevice({ name: 'Boiler', steps: [makeStep({ title: 'Anode', supply_needed_date: '2025-06-10' })] })]

    const { unmount } = renderHeader(devices, 'de')
    fireEvent.click(screen.getByRole('button', { name: 'Benachrichtigungen' }))
    expect(screen.getByText('Anode (Boiler) ist seit 5 Tagen überfällig')).toBeInTheDocument()
    unmount()

    renderHeader(devices, 'pl')
    fireEvent.click(screen.getByRole('button', { name: 'Powiadomienia' }))
    expect(screen.getByText('Anode (Boiler): zaległe od 5 dni')).toBeInTheDocument()
  })

  it('keeps very long step and device names wrapped inside the dropdown', () => {
    mockToday(2025, 6, 15)
    const longStep = 'Step-'.repeat(50)
    renderHeader([makeDevice({ name: 'Device-'.repeat(40), steps: [makeStep({ title: longStep, supply_needed_date: '2025-06-10' })] })])

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    const item = screen.getByRole('button', { name: new RegExp(longStep.slice(0, 20)) })
    expect(item).toHaveClass('break-words')
    expect(item.closest('ul')?.parentElement).toHaveClass('max-w-[calc(100vw-2rem)]')
  })
})
