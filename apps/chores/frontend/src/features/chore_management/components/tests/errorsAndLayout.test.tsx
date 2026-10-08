import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../tests/test-utils'
import { server } from '../../../../tests/mocks/server'
import { mockInstances, mockTemplates, mockTimeline } from '../../../../tests/mocks/handlers'
import { ChoresList } from '../ChoresList'
import { TaskCard } from '../TaskCard'
import { DashboardView } from '../DashboardView'
import { BoardView } from '../BoardView'
import { TaskTimelineModal } from '../TaskTimelineModal'
import { GoalDonutChart } from '../GoalDonutChart'

const LONG_NAME = 'SupercalifragilisticexpialidociousChoreNameThatNeverEndsAndHasNoSpacesAtAllForOverflowChecks'
const longTemplate = { ...mockTemplates[0], name: LONG_NAME, description: LONG_NAME.repeat(2) }

describe('long user content', () => {
  it('truncates long chore names in the daily list and keeps the actions visible', () => {
    renderWithProviders(<ChoresList chores={[mockInstances[0]]} templates={[longTemplate]} dueDate="2026-08-16" />)
    const name = screen.getByText(LONG_NAME)
    expect(name).toHaveClass('truncate')
    expect(name).toHaveAttribute('title', LONG_NAME)
    expect(name.closest('div.min-w-0')).not.toBeNull()
    expect(screen.getByRole('button', { name: /assigned/i })).toBeInTheDocument()
  })

  it('truncates the template name and wraps the description on board cards', () => {
    const { container } = renderWithProviders(<TaskCard template={longTemplate} />)
    const heading = screen.getByRole('heading', { name: LONG_NAME })
    expect(heading).toHaveClass('truncate')
    expect(heading).toHaveAttribute('title', LONG_NAME)
    expect(screen.getByText(LONG_NAME.repeat(2))).toHaveClass('break-words')
    expect(container.firstElementChild).toHaveClass('min-w-0')
  })

  it('truncates long names of who completed a chore in the history', async () => {
    renderWithProviders(<TaskTimelineModal template={longTemplate} onClose={() => {}} />)
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: LONG_NAME })).toHaveClass('truncate')
  })

  it('shows the fallback title for an instance whose template was deleted', () => {
    renderWithProviders(<ChoresList chores={[mockInstances[0]]} templates={[]} dueDate="2026-08-16" />)
    expect(screen.getByText('Unknown chore')).toBeInTheDocument()
  })

  it('tolerates a null chore list from the API', () => {
    renderWithProviders(<ChoresList chores={null as never} templates={mockTemplates} />)
    expect(screen.getByText('No chores scheduled for today')).toBeInTheDocument()
  })
})

describe('failed requests are shown, not swallowed', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('alfheim_active_household_id', 'hh-1')
  })

  it('shows why claiming a chore failed', async () => {
    server.use(
      http.post('*/instances/:id/claim', () =>
        HttpResponse.json({ detail: 'This chore is already claimed by another household member.' }, { status: 409 })
      )
    )
    const user = userEvent.setup()
    renderWithProviders(
      <ChoresList chores={[{ ...mockInstances[0], assigned_to: null }]} templates={mockTemplates} dueDate="2026-08-16" />
    )
    await user.click(screen.getByRole('button', { name: /claim/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already claimed by another household member')
  })

  it('shows the HTTP status text when the server sends no error body', async () => {
    server.use(http.post('*/instances/:id/complete', () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    renderWithProviders(<ChoresList chores={[mockInstances[0]]} templates={mockTemplates} dueDate="2026-08-16" />)
    await user.click(screen.getByRole('button', { name: 'Complete chore' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal Server Error')
  })

  it('shows why deleting a template failed and keeps the card', async () => {
    server.use(
      http.delete('*/templates/:id', () => HttpResponse.json({ detail: 'Template is in use.' }, { status: 409 }))
    )
    const user = userEvent.setup()
    renderWithProviders(<TaskCard template={mockTemplates[0]} />)
    await user.click(screen.getByRole('button', { name: 'Delete template' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete template' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Template is in use.')
    expect(screen.getByText('Vacuum Living Room')).toBeInTheDocument()
  })

  it('marks the integration cards as unavailable when the other apps cannot be reached', async () => {
    server.use(
      http.get(/\/shopping-lists$/, () => new HttpResponse(null, { status: 502 })),
      http.get(/\/maintenance\/summary$/, () => new HttpResponse(null, { status: 502 }))
    )
    renderWithProviders(<DashboardView />)
    expect(await screen.findByText(/Failed to load chore dashboard data/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('UNAVAILABLE')).toHaveLength(2))
    expect(screen.queryByText('CONNECTED')).not.toBeInTheDocument()
  })

  it('shows a board error instead of an empty board', async () => {
    server.use(http.get(/\/templates$/, () => new HttpResponse(null, { status: 500 })))
    renderWithProviders(<BoardView />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load chore templates board.')
  })

  it('shows a history error', async () => {
    server.use(http.get(/\/templates\/[^/]+\/timeline/, () => new HttpResponse(null, { status: 500 })))
    renderWithProviders(<TaskTimelineModal template={mockTemplates[0]} onClose={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load task timeline history.')
  })
})

describe('localized rendering', () => {
  it.each([
    ['de', 'Unbekannte Aufgabe', 'Verlauf'],
    ['pl', 'Nieznane zadanie', 'Historia'],
  ] as const)('renders the %s list labels', (language, unknown, history) => {
    renderWithProviders(
      <ChoresList chores={mockInstances} templates={mockTemplates.slice(1)} dueDate="2026-08-16" />,
      undefined,
      language
    )
    expect(screen.getByText(unknown)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: history })).toBeInTheDocument()
  })

  it('renders the timeline dates in the app language', async () => {
    renderWithProviders(<TaskTimelineModal template={mockTemplates[0]} onClose={() => {}} />, undefined, 'pl')
    const expected = new Date(mockTimeline[0].completed_at).toLocaleString('pl')
    expect(await screen.findByText(expected)).toBeInTheDocument()
  })
})

describe('GoalDonutChart', () => {
  it('draws the ring as a conic gradient with one range per status, without inline svg', () => {
    const { container } = renderWithProviders(<GoalDonutChart chores={mockInstances} />)
    const ring = screen.getByTestId('status-donut')
    expect(ring.style.background).toContain('conic-gradient')
    expect(ring.style.background).toContain('0deg 180deg')
    expect(ring.style.background).toContain('180deg 360deg')
    expect(container.querySelector('svg circle')).toBeNull()
  })
})
