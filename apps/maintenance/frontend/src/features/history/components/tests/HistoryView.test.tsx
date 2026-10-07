import React from 'react'
import { screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/mocks/server'
import { renderWithProviders } from '../../../../tests/test-utils'
import { HistoryView } from '../HistoryView'
import * as useHistoryHook from '../../hooks/useHistory'

function mockHistory(state: { data?: unknown; isLoading?: boolean; isError?: boolean }) {
  vi.spyOn(useHistoryHook, 'useServiceHistory').mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...state,
  } as unknown as ReturnType<typeof useHistoryHook.useServiceHistory>)
}

const EVENT = {
  id: 1,
  date: '2025-02-01',
  performer: 'Ada',
  notes: 'Replaced the gasket',
  device_id: 1,
  device_name: 'Washing Machine',
  device_location: 'Laundry Room',
  completed_steps: ['Clean Filter', 'Descale Drum'],
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HistoryView', () => {
  it('renders the localized error message on error state', () => {
    mockHistory({ isError: true })
    renderWithProviders(<HistoryView />)

    expect(
      screen.getByText('Failed to load service history. Please try again.')
    ).toBeInTheDocument()
  })

  it('renders the same error in German', () => {
    mockHistory({ isError: true })
    renderWithProviders(<HistoryView />, { locale: 'de' })

    expect(
      screen.getByText('Wartungsverlauf konnte nicht geladen werden. Bitte versuchen Sie es erneut.')
    ).toBeInTheDocument()
  })

  it('renders the empty history placeholder when no events are logged', async () => {
    mockHistory({ data: [] })
    const { container } = renderWithProviders(<HistoryView />)

    expect(screen.getByText('No History Found')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('lists events with the stored calendar day, performer and completed steps', () => {
    mockHistory({ data: [EVENT] })
    renderWithProviders(<HistoryView />)

    expect(screen.getByText('Feb 1, 2025')).toBeInTheDocument()
    expect(screen.getByText('By Ada')).toBeInTheDocument()
    expect(screen.getByText('Completed: Clean Filter, Descale Drum')).toBeInTheDocument()
    expect(screen.getByText('1 record')).toBeInTheDocument()
    expect(screen.getByText('"Replaced the gasket"')).toBeInTheDocument()
  })

  it('formats dates in the active language', () => {
    mockHistory({ data: [EVENT] })
    renderWithProviders(<HistoryView />, { locale: 'de' })

    expect(screen.getByText(/^1\. Feb\.? 2025$/)).toBeInTheDocument()
    expect(screen.getByText('Von Ada')).toBeInTheDocument()
  })

  it('wraps very long notes, performers and step names instead of overflowing', () => {
    const longNote = 'unbreakable-'.repeat(60)
    const longStep = 'Step-'.repeat(60)
    mockHistory({
      data: [{ ...EVENT, performer: 'P'.repeat(150), notes: longNote, completed_steps: [longStep] }],
    })
    renderWithProviders(<HistoryView />)

    expect(screen.getByText(`"${longNote}"`)).toHaveClass('break-words')
    expect(screen.getByTitle(longStep)).toHaveClass('truncate')
    expect(screen.getByText(`By ${'P'.repeat(150)}`)).toHaveClass('break-words')
  })

  it('loads the service history of the active household from the API', async () => {
    vi.restoreAllMocks()
    server.use(http.get('*/maintenance/history', () => HttpResponse.json([EVENT])))
    renderWithProviders(<HistoryView />)

    expect(await screen.findByText('Completed: Clean Filter, Descale Drum')).toBeInTheDocument()
    expect(screen.getByText('Washing Machine')).toBeInTheDocument()
  })

  it('shows the error state when the history request fails', async () => {
    vi.restoreAllMocks()
    server.use(http.get('*/maintenance/history', () => HttpResponse.json({ detail: 'boom' }, { status: 500 })))
    renderWithProviders(<HistoryView />)

    expect(await screen.findByText('Failed to load service history. Please try again.')).toBeInTheDocument()
  })
})
