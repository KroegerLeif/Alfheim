import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/mocks/server'
import { mockToday, renderWithProviders } from '../../../../tests/test-utils'
import { makeDevice, makeStep } from '../../../../tests/fixtures'
import { ScheduledTaskItem } from '../ScheduledTaskItem'

afterEach(() => {
  vi.useRealTimers()
})

const DEVICE = makeDevice({ name: 'Boiler', location: 'Basement' })

function renderItem(stepOverrides: Parameters<typeof makeStep>[0] = {}, locale: 'en' | 'de' = 'en') {
  const step = makeStep({ title: 'Flush tank', description: 'Drain and refill', recurrence: 6, ...stepOverrides })
  renderWithProviders(<ScheduledTaskItem step={step} device={DEVICE} />, { locale })
  return step
}

const badgeText = () => document.querySelector('span.rounded-full')?.textContent

describe('ScheduledTaskItem due badge', () => {
  it.each([
    ['2025-06-10', 'OVERDUE (5d)'],
    ['2025-06-14', 'OVERDUE (1d)'],
    ['2025-06-15', 'DUE SOON (0d)'],
    ['2025-06-16', 'DUE SOON (1d)'],
    ['2025-06-29', 'DUE SOON (14d)'],
    ['2025-06-30', 'GOOD (15d)'],
  ])('shows %s as %s', (dueDate, expected) => {
    mockToday(2025, 6, 15)
    renderItem({ supply_needed_date: dueDate })
    expect(badgeText()).toBe(expected)
  })

  it('does not shift the due day late in the evening', () => {
    mockToday(2025, 6, 15, 23)
    renderItem({ supply_needed_date: '2025-06-16' })
    expect(badgeText()).toBe('DUE SOON (1d)')
  })

  it('shows a neutral badge for a step without a due date', () => {
    renderItem({ supply_needed_date: null })
    expect(badgeText()).toBe('Not scheduled')
  })

  it('translates the badge', () => {
    mockToday(2025, 6, 15)
    renderItem({ supply_needed_date: '2025-06-10' }, 'de')
    expect(badgeText()).toBe('ÜBERFÄLLIG (5T)')
  })
})

describe('ScheduledTaskItem details', () => {
  it('expands to show due date, interval and no reference photo picker', async () => {
    mockToday(2025, 6, 15)
    const { container } = renderWithProviders(
      <ScheduledTaskItem step={makeStep({ title: 'Flush tank', supply_needed_date: '2025-08-01', recurrence: 1 })} device={DEVICE} />
    )

    const toggle = screen.getByRole('button', { name: /Show Details/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('Aug 1, 2025').length).toBeGreaterThan(0)
    expect(screen.getByText('1 month')).toBeInTheDocument()
    expect(screen.queryByText(/photo/i)).not.toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).toBeNull()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('saves the trimmed comment through the task state endpoint and confirms it', async () => {
    let received: { stepId: string; body: unknown } | undefined
    server.use(
      http.post('*/tasks/:stepId/state', async ({ params, request }) => {
        received = { stepId: String(params.stepId), body: await request.json() }
        return HttpResponse.json({ id: 1 })
      })
    )
    const step = renderItem({ supply_needed_date: '2030-01-01' })

    fireEvent.click(screen.getByRole('button', { name: /Show Details/ }))
    fireEvent.change(screen.getByLabelText('Inspection Comment'), { target: { value: '  Replaced the anode  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Comment' }))

    expect(await screen.findByRole('button', { name: 'Saved!' })).toBeInTheDocument()
    expect(received).toEqual({ stepId: String(step.id), body: { comment: 'Replaced the anode' } })
  })

  it('shows a localized error when saving fails and lets the user retry', async () => {
    server.use(http.post('*/tasks/:stepId/state', () => HttpResponse.json({ detail: 'nope' }, { status: 500 })))
    renderItem({ supply_needed_date: '2030-01-01' })

    fireEvent.click(screen.getByRole('button', { name: /Show Details/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Comment' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Comment' })).not.toBeDisabled())
  })

  it('keeps very long titles, device names and locations truncated in the summary row', () => {
    const longTitle = 'Inspect-and-recalibrate-every-single-sensor-'.repeat(6)
    const longDevice = makeDevice({ name: 'Device-'.repeat(40), location: 'Location-'.repeat(40) })
    renderWithProviders(<ScheduledTaskItem step={makeStep({ title: longTitle })} device={longDevice} />)

    expect(screen.getByText(longTitle)).toHaveClass('truncate')
    expect(screen.getByText('Device-'.repeat(40))).toHaveClass('truncate')
    expect(screen.getByText('Location-'.repeat(40))).toHaveClass('truncate')
    // The summary row must be a 12-column grid at every width: col-span-12 inside a 1-column grid
    // creates implicit columns that grow with long content.
    expect(screen.getByRole('button', { name: new RegExp(longTitle.slice(0, 20)) })).toHaveClass('grid-cols-12')
  })
})
