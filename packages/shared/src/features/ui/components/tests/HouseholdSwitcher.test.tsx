import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { HouseholdSwitcher } from '../HouseholdSwitcher'
import { LanguageProvider } from '../../../i18n/utils/LanguageContext'

describe('HouseholdSwitcher Component', () => {
  const mockHouseholds = [
    { id: 'hh-1', name: 'Main Residence', slug: 'main-residence', is_default: true },
    { id: 'hh-2', name: 'Summer House', slug: 'summer-house', is_default: false },
  ]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('alfheim_cached_households', JSON.stringify(mockHouseholds))
    localStorage.setItem('alfheim_active_household_id', 'hh-1')
  })

  it('passes accessibility audit', async () => {
    const { container } = render(
      <LanguageProvider defaultLanguage="en">
        <HouseholdSwitcher />
      </LanguageProvider>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders active household name from cached storage', () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <HouseholdSwitcher />
      </LanguageProvider>
    )

    expect(screen.getByText('Main Residence')).toBeInTheDocument()
  })

  it('opens dropdown and allows selecting another household', async () => {
    const user = userEvent.setup()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    render(
      <LanguageProvider defaultLanguage="en">
        <HouseholdSwitcher />
      </LanguageProvider>
    )

    const button = screen.getByRole('button')
    await user.click(button)

    // Verify dropdown items are displayed
    expect(screen.getByText('Summer House')).toBeInTheDocument()

    // Click to select the second household
    await user.click(screen.getByText('Summer House'))

    expect(localStorage.getItem('alfheim_active_household_id')).toBe('hh-2')
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'storage-household-changed' }))
  })
})
