import React from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HouseholdGate } from '../HouseholdGate'
import { HouseholdContext, type ActiveHouseholdContextValue } from '../HouseholdProvider'
import { LanguageProvider } from '../../i18n/utils/LanguageContext'

const households = [
  { id: 'hh-1', name: 'Main' },
  { id: 'hh-2', name: 'Summer' },
]

function makeValue(overrides: Partial<ActiveHouseholdContextValue> = {}): ActiveHouseholdContextValue {
  return {
    status: 'ready',
    householdId: 'hh-1',
    role: 'MEMBER',
    household: households[0],
    households,
    setActiveHousehold: vi.fn(),
    refetch: vi.fn().mockResolvedValue(undefined),
    error: null,
    clearError: vi.fn(),
    ...overrides,
  }
}

function renderGate(value: ActiveHouseholdContextValue, language: 'en' | 'de' = 'en') {
  return render(
    <LanguageProvider defaultLanguage={language}>
      <HouseholdContext.Provider value={value}>
        <HouseholdGate>
          <p>scoped content</p>
        </HouseholdGate>
      </HouseholdContext.Provider>
    </LanguageProvider>,
  )
}

describe('HouseholdGate', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('renders children when ready', () => {
    renderGate(makeValue())
    expect(screen.getByText('scoped content')).toBeInTheDocument()
  })

  it('shows a spinner while loading', () => {
    renderGate(makeValue({ status: 'loading', householdId: null, household: null }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('scoped content')).not.toBeInTheDocument()
  })

  it('links to household onboarding when the user has no household', () => {
    renderGate(makeValue({ status: 'none', householdId: null, household: null, households: [] }))
    const link = screen.getByRole('link', { name: 'Create or join a household' })
    expect(link).toHaveAttribute('href', '/household/onboarding')
    expect(screen.queryByText('scoped content')).not.toBeInTheDocument()
  })

  it('uses German strings', () => {
    renderGate(makeValue({ status: 'none', householdId: null, household: null, households: [] }), 'de')
    expect(screen.getAllByText('Haushalt erstellen oder beitreten').length).toBeGreaterThan(0)
  })

  it.each(['household_forbidden', 'household_required', 'household_invalid'] as const)(
    'offers switching and onboarding on %s',
    async (code) => {
      const value = makeValue({ error: code })
      renderGate(value)
      expect(screen.getByRole('alert')).toHaveTextContent('No access to this household')
      expect(screen.getByRole('link')).toHaveAttribute('href', '/household/onboarding')
      await userEvent.click(screen.getByRole('button', { name: 'Switch to Summer' }))
      expect(value.setActiveHousehold).toHaveBeenCalledWith('hh-2')
    },
  )

  it('shows a retry message when the household service is unavailable', async () => {
    const value = makeValue({ error: 'household_service_unavailable' })
    renderGate(value)
    expect(screen.getByRole('alert')).toHaveTextContent('Household service unavailable')
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(value.refetch).toHaveBeenCalled()
  })

  it('shows the retry message when the household list failed to load', () => {
    renderGate(makeValue({ status: 'error', householdId: null, household: null, households: [] }))
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('remounts its content when the active household changes', () => {
    const mounts = vi.fn()
    function Probe() {
      React.useEffect(() => mounts(), [])
      return <p>probe</p>
    }
    const tree = (value: ActiveHouseholdContextValue) => (
      <LanguageProvider defaultLanguage="en">
        <HouseholdContext.Provider value={value}>
          <HouseholdGate>
            <Probe />
          </HouseholdGate>
        </HouseholdContext.Provider>
      </LanguageProvider>
    )
    const { rerender } = render(tree(makeValue()))
    rerender(tree(makeValue()))
    expect(mounts).toHaveBeenCalledTimes(1)
    rerender(tree(makeValue({ householdId: 'hh-2', household: households[1] })))
    expect(mounts).toHaveBeenCalledTimes(2)
  })

  it('does not gate on role errors', () => {
    renderGate(makeValue({ error: 'household_role_forbidden' }))
    expect(screen.getByText('scoped content')).toBeInTheDocument()
  })
})
