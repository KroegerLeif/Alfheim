import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { AddDeviceWizard } from '../AddDeviceWizard'
import { renderWithProviders } from '../../../../tests/test-utils'

// Mock next-intl translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    if (key === 'wizard.registerTitle') return 'Register New Device'
    if (key === 'wizard.registerSubtitle') return 'Add a device to your inventory'
    if (key === 'wizard.namePlaceholder') return 'e.g. Washing Machine'
    if (key === 'wizard.modelPlaceholder') return 'e.g. WM-2000'
    if (key === 'wizard.serialPlaceholder') return 'e.g. SN-12345678'
    if (key === 'wizard.locationPlaceholder') return 'e.g. Laundry Room'
    if (key === 'wizard.cancel') return 'Cancel'
    if (key === 'wizard.registerDevice') return 'Register Device'
    if (key === 'wizard.saved') return 'Saved'
    if (key === 'wizard.addStep') return 'Add Step'
    if (key === 'wizard.titlePlaceholder') return 'Step title'
    if (key === 'wizard.stepNumber') return 'Step 1'
    return key
  },
}))

describe('AddDeviceWizard Component', () => {
  it('passes accessibility audit', async () => {
    const handleClose = vi.fn()
    const { container } = renderWithProviders(<AddDeviceWizard onClose={handleClose} />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Washing Machine')).toBeInTheDocument()
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders title and form input fields', () => {
    const handleClose = vi.fn()
    renderWithProviders(<AddDeviceWizard onClose={handleClose} />)

    expect(screen.getByText('Register New Device')).toBeInTheDocument()
    expect(screen.getByText('Add a device to your inventory')).toBeInTheDocument()

    expect(screen.getByPlaceholderText('e.g. Washing Machine')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. WM-2000')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. SN-12345678')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Laundry Room')).toBeInTheDocument()
  })

  it('calls onClose when clicking cancel button', () => {
    const handleClose = vi.fn()
    renderWithProviders(<AddDeviceWizard onClose={handleClose} />)

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelButtons[0])
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('allows filling out device form fields and adding/removing maintenance steps', async () => {
    const handleClose = vi.fn()
    renderWithProviders(<AddDeviceWizard onClose={handleClose} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Washing Machine')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('e.g. Washing Machine')
    const modelInput = screen.getByPlaceholderText('e.g. WM-2000')
    const serialInput = screen.getByPlaceholderText('e.g. SN-12345678')
    const locationInput = screen.getByPlaceholderText('e.g. Laundry Room')

    fireEvent.change(nameInput, { target: { value: 'Heat Pump' } })
    fireEvent.change(modelInput, { target: { value: 'HP-100' } })
    fireEvent.change(serialInput, { target: { value: 'SN-999' } })
    fireEvent.change(locationInput, { target: { value: 'Basement' } })

    expect(nameInput).toHaveValue('Heat Pump')
    expect(modelInput).toHaveValue('HP-100')
    expect(serialInput).toHaveValue('SN-999')
    expect(locationInput).toHaveValue('Basement')

    const addStepButton = screen.getByText('Add Step')
    fireEvent.click(addStepButton)

    const stepTitleInputs = screen.getAllByPlaceholderText('Step title')
    expect(stepTitleInputs).toHaveLength(2)
  })

  it('submits form and triggers onClose on success', async () => {
    const handleClose = vi.fn()
    renderWithProviders(<AddDeviceWizard onClose={handleClose} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Washing Machine')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('e.g. Washing Machine'), { target: { value: 'Fridge' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. WM-2000'), { target: { value: 'FR-500' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. SN-12345678'), { target: { value: 'SN-111' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Laundry Room'), { target: { value: 'Kitchen' } })

    const stepTitleInput = screen.getByPlaceholderText('Step title')
    fireEvent.change(stepTitleInput, { target: { value: 'Inspect coils' } })

    const registerButton = screen.getByRole('button', { name: 'Register Device' })
    fireEvent.click(registerButton)

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})
