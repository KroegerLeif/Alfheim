import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { MaintenanceMode } from '../MaintenanceMode'
import { renderWithProviders } from '../../../../tests/test-utils'
import { Device } from '@/shared/types'

// Mock AuthContext
vi.mock('@/core/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Test User', email: 'test@example.com' },
  }),
}))

// Mock next-intl translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    if (key === 'wizardMode.tagline') return 'Guided Maintenance'
    if (key === 'wizardMode.noStepsDefined') return 'No Steps Defined'
    if (key === 'wizardMode.noStepsDesc') return 'This device has no maintenance steps configured.'
    if (key === 'wizardMode.close') return 'Close'
    if (key === 'wizardMode.next') return 'Next Step'
    if (key === 'wizardMode.back') return 'Previous Step'
    if (key === 'wizardMode.markCompleted') return 'Mark step as completed'
    if (key === 'wizardMode.finishAndSave') return 'Finish Maintenance'
    if (key === 'wizardMode.saving') return 'Saving...'
    if (key === 'wizardMode.progress') return '50%'
    return key
  },
}))

describe('MaintenanceMode Component', () => {
  const mockDeviceWithSteps: Device = {
    id: 1,
    name: 'Washing Machine',
    model: 'WM-2000',
    serial: 'SN-12345',
    category: 'Appliance',
    location: 'Laundry Room',
    status: 'active',
    service_interval_months: 6,
    household_id: 1,
    history_events: [],
    steps: [
      {
        id: 101,
        title: 'Clean Drain Pump Filter',
        description: 'Remove lint and debris from the lower pump filter.',
        recurrence: 3,
        supply_item: 'Drain Pan',
        device_id: 1,
      },
      {
        id: 102,
        title: 'Descale Drum',
        description: 'Run hot cycle with descaling powder.',
        recurrence: 6,
        supply_item: 'Descaling Powder',
        device_id: 1,
      },
    ],
  }

  const mockDeviceNoSteps: Device = {
    id: 2,
    name: 'Simple Fan',
    model: 'SF-100',
    serial: 'SN-00000',
    category: 'Appliance',
    location: 'Bedroom',
    status: 'active',
    service_interval_months: 12,
    household_id: 1,
    history_events: [],
    steps: [],
  }

  it('passes accessibility audit', async () => {
    const handleClose = vi.fn()
    const { container } = renderWithProviders(
      <MaintenanceMode device={mockDeviceWithSteps} onClose={handleClose} />
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders fallback UI when device has no maintenance steps', () => {
    const handleClose = vi.fn()
    renderWithProviders(<MaintenanceMode device={mockDeviceNoSteps} onClose={handleClose} />)

    expect(screen.getByText('No Steps Defined')).toBeInTheDocument()
    expect(screen.getByText('This device has no maintenance steps configured.')).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: 'Close' })
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('allows step navigation, marking step as done, and writing step notes', () => {
    const handleClose = vi.fn()
    renderWithProviders(
      <MaintenanceMode device={mockDeviceWithSteps} onClose={handleClose} />
    )

    // Device name displayed in top header
    expect(screen.getByText('Washing Machine')).toBeInTheDocument()

    // Step 1 details
    expect(screen.getByText('Clean Drain Pump Filter')).toBeInTheDocument()
    expect(
      screen.getByText('Remove lint and debris from the lower pump filter.')
    ).toBeInTheDocument()

    // Toggle step done button
    const markDoneBtn = screen.getByRole('button', { name: 'Mark step as completed' })
    fireEvent.click(markDoneBtn)

    // Type notes into step notes area
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Filter was dirty.' } })
    expect(textarea).toHaveValue('Filter was dirty.')

    // Navigate next
    const nextBtn = screen.getByRole('button', { name: /Next Step/i })
    fireEvent.click(nextBtn)

    // Step 2 details
    expect(screen.getByText('Descale Drum')).toBeInTheDocument()

    // Navigate back
    const backBtn = screen.getByRole('button', { name: /Previous Step/i })
    fireEvent.click(backBtn)
    expect(screen.getByText('Clean Drain Pump Filter')).toBeInTheDocument()
  })

  it('allows completing all steps and finishing maintenance', async () => {
    const handleClose = vi.fn()
    renderWithProviders(
      <MaintenanceMode device={mockDeviceWithSteps} onClose={handleClose} />
    )

    // Mark step 1 done
    fireEvent.click(screen.getByRole('button', { name: 'Mark step as completed' }))

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /Next Step/i }))

    // Mark step 2 done
    fireEvent.click(screen.getByRole('button', { name: 'Mark step as completed' }))

    // Finish button should be enabled
    const finishBtn = screen.getByRole('button', { name: /Finish Maintenance/i })
    expect(finishBtn).not.toBeDisabled()
    fireEvent.click(finishBtn)

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled()
    })
  })
})
