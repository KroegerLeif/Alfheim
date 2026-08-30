import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { renderWithProviders } from '../../../../tests/test-utils'
import { WizardSteps } from '../WizardSteps'
import * as navigationModule from '@/navigation'

describe('WizardSteps Component', () => {
  it('passes accessibility audit', async () => {
    const { container } = renderWithProviders(<WizardSteps />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders step 1 and validates required fields before proceeding', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WizardSteps />)

    // Step 1 headers and inputs
    expect(screen.getByText('choreDetails')).toBeInTheDocument()
    expect(screen.getByText('taskName')).toBeInTheDocument()

    // Back button is disabled on step 1
    const backBtn = screen.getByRole('button', { name: /back/i })
    expect(backBtn).toBeDisabled()

    // Clicking next without typing a name triggers validation
    const nextBtn = screen.getByRole('button', { name: /next/i })
    await user.click(nextBtn)

    expect(screen.getByText('nameRequired')).toBeInTheDocument()

    // Fill in task name and verify validation clears on next
    const nameInput = screen.getByPlaceholderText('taskNamePlaceholder')
    await user.type(nameInput, 'Clean Kitchen Counters')
    await user.click(nextBtn)

    // Should transition to step 2
    expect(screen.getByText('importanceReward')).toBeInTheDocument()
  })

  it('navigates through all wizard steps and submits form', async () => {
    const user = userEvent.setup()
    const pushMock = vi.fn()
    vi.spyOn(navigationModule, 'useRouter').mockReturnValue({
      push: pushMock,
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    } as unknown as ReturnType<typeof navigationModule.useRouter>)

    renderWithProviders(<WizardSteps />)

    // Step 1: Fill name and description
    const nameInput = screen.getByPlaceholderText('taskNamePlaceholder')
    const descInput = screen.getByPlaceholderText('instructionsPlaceholder')
    await user.type(nameInput, 'Mop Floor')
    await user.type(descInput, 'Use wood floor cleaner')

    const nextBtn = screen.getByRole('button', { name: /next/i })
    await user.click(nextBtn)

    // Step 2: Points selection
    expect(screen.getByText('importanceReward')).toBeInTheDocument()
    const pointsBtn = screen.getByText(/15 PTS/i)
    await user.click(pointsBtn)
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 3: Recurrence rules
    expect(screen.getByText('dailyExpiryRules')).toBeInTheDocument()
    const cumulativeOption = screen.getByText('cumulativeTitle')
    await user.click(cumulativeOption)
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 4: Assignment rules
    expect(screen.getByText('assignmentRules')).toBeInTheDocument()
    const finishBtn = screen.getByRole('button', { name: /finishSave/i })
    await user.click(finishBtn)

    // Verify submission redirects to board
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/board')
    })
  })

  it('allows navigating backward and preserves entered state', async () => {
    const user = userEvent.setup()
    renderWithProviders(<WizardSteps />)

    // Step 1: Type name
    const nameInput = screen.getByPlaceholderText('taskNamePlaceholder')
    await user.type(nameInput, 'Dust Shelves')
    await user.click(screen.getByRole('button', { name: /next/i }))

    // Step 2: Now on step 2, click back
    expect(screen.getByText('importanceReward')).toBeInTheDocument()
    const backBtn = screen.getByRole('button', { name: /back/i })
    await user.click(backBtn)

    // Step 1: Check name is preserved
    expect(screen.getByText('choreDetails')).toBeInTheDocument()
    const preservedInput = screen.getByPlaceholderText('taskNamePlaceholder') as HTMLInputElement
    expect(preservedInput.value).toBe('Dust Shelves')
  })
})
