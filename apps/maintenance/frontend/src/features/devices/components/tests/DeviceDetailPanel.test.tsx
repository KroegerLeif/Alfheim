import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { mockToday, renderWithProviders } from '../../../../tests/test-utils'
import { makeDevice, makeHistoryEvent, makeStep } from '../../../../tests/fixtures'
import { DeviceDetailPanel } from '../DeviceDetailPanel'

afterEach(() => {
  vi.useRealTimers()
})

describe('DeviceDetailPanel', () => {
  it('offers overview, steps and timeline tabs and no manuals tab', () => {
    renderWithProviders(<DeviceDetailPanel device={makeDevice()} onClose={vi.fn()} />)

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Steps', 'Timeline'])
    expect(screen.queryByText(/manual/i)).not.toBeInTheDocument()
  })

  it('shows the device data and starts maintenance from the overview', async () => {
    const onStart = vi.fn()
    const onClose = vi.fn()
    const device = makeDevice({ notes: 'Check the seals', status: 'maintenance', serial: 'SN-42' })
    const { container } = renderWithProviders(
      <DeviceDetailPanel device={device} onClose={onClose} onStartMaintenance={onStart} />
    )

    expect(screen.getByText('SN-42')).toBeInTheDocument()
    expect(screen.getByText('"Check the seals"')).toBeInTheDocument()
    expect(screen.getByText(/currently flagged as Maintenance/)).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    fireEvent.click(screen.getByRole('button', { name: 'Start Maintenance' }))
    expect(onStart).toHaveBeenCalledWith(device)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the due state of each step with calendar-correct dates', () => {
    mockToday(2025, 6, 15)
    const device = makeDevice({
      steps: [
        makeStep({ title: 'Late step', supply_needed_date: '2025-06-10', last_completed: '2024-12-10' }),
        makeStep({ title: 'Soon step', supply_needed_date: '2025-06-16' }),
        makeStep({ title: 'Far step', supply_needed_date: '2025-12-01' }),
        makeStep({ title: 'Unplanned step', supply_needed_date: null }),
      ],
    })
    renderWithProviders(<DeviceDetailPanel device={device} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Steps' }))

    expect(screen.getByText('Overdue by 5d')).toBeInTheDocument()
    expect(screen.getByText('In 1d')).toBeInTheDocument()
    expect(screen.getByText('In 169d')).toBeInTheDocument()
    expect(screen.getByText('Not scheduled', { selector: 'span.rounded-full' })).toBeInTheDocument()
    expect(screen.getByText('Jun 10, 2025')).toBeInTheDocument()
    expect(screen.getByText('Dec 10, 2024')).toBeInTheDocument()
  })

  it('shows an empty state for a device without steps', () => {
    renderWithProviders(<DeviceDetailPanel device={makeDevice()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Steps' }))
    expect(screen.getByText('No maintenance steps defined.')).toBeInTheDocument()
  })

  it('lists the service timeline of the device', () => {
    const device = makeDevice({
      history_events: [
        makeHistoryEvent({ date: '2025-03-04', performer: 'Ada', completed_steps: ['Clean Filter'], notes: 'All good' }),
        makeHistoryEvent({ date: '2025-01-02', performer: 'Bo', completed_steps: [] }),
      ],
    })
    renderWithProviders(<DeviceDetailPanel device={device} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Timeline' }))

    expect(screen.getByText('Completed: Clean Filter')).toBeInTheDocument()
    expect(screen.getByText('Maintenance Service')).toBeInTheDocument()
    expect(screen.getByText('Mar 4, 2025')).toBeInTheDocument()
    expect(screen.getByText('By Bo')).toBeInTheDocument()
    expect(screen.getByText('"All good"')).toBeInTheDocument()
  })

  it('translates the tabs and step badges to German', () => {
    mockToday(2025, 6, 15)
    const device = makeDevice({ steps: [makeStep({ supply_needed_date: '2025-06-10' })] })
    renderWithProviders(<DeviceDetailPanel device={device} onClose={vi.fn()} />, { locale: 'de' })

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Übersicht', 'Schritte', 'Chronik'])
    fireEvent.click(screen.getByRole('tab', { name: 'Schritte' }))
    expect(screen.getByText('Überfällig seit 5T')).toBeInTheDocument()
  })

  it('wraps very long step titles, descriptions, serials and notes', () => {
    const longTitle = 'Replace-the-extraordinarily-long-named-part-'.repeat(5)
    const longDescription = 'procedure_'.repeat(60)
    const longSerial = 'SERIAL' + '9'.repeat(100)
    const device = makeDevice({
      serial: longSerial,
      notes: 'note_'.repeat(80),
      steps: [makeStep({ title: longTitle, description: longDescription })],
    })
    renderWithProviders(<DeviceDetailPanel device={device} onClose={vi.fn()} />)

    expect(screen.getByText(longSerial)).toHaveClass('break-all')
    expect(screen.getByText(`"${'note_'.repeat(80)}"`)).toHaveClass('break-words')

    fireEvent.click(screen.getByRole('tab', { name: 'Steps' }))
    expect(screen.getByText(longTitle)).toHaveClass('break-words')
    expect(screen.getByText(longDescription)).toHaveClass('break-words')
  })

  it('caps the panel title width so a very long device name wraps instead of hiding the close button', () => {
    const longName = 'Name'.repeat(80)
    renderWithProviders(<DeviceDetailPanel device={makeDevice({ name: longName })} onClose={vi.fn()} />)

    const title = screen.getByText(longName)
    expect(title).toHaveClass('md:max-w-[22rem]')
    expect(title.className).toContain('overflow-wrap:anywhere')
  })
})
