import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { AddDeviceWizard } from '../AddDeviceWizard'
import { renderWithProviders } from '../../../../tests/test-utils'
import { server } from '../../../../tests/mocks/server'

describe('AddDeviceWizard Component', () => {
  it('passes accessibility audit', async () => {
    const handleClose = vi.fn()
    const { container } = renderWithProviders(<AddDeviceWizard onClose={handleClose} />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Heat Pump Daikin')).toBeInTheDocument()
    })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders title and form input fields', () => {
    const handleClose = vi.fn()
    renderWithProviders(<AddDeviceWizard onClose={handleClose} />)

    expect(screen.getByText('Register New Device')).toBeInTheDocument()
    expect(screen.getByText('Create a device and define its initial maintenance schedule.')).toBeInTheDocument()

    expect(screen.getByPlaceholderText('e.g. Heat Pump Daikin')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. EHVH08S23EJ6V')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. DK-90812903-HP')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Basement / Utility Room')).toBeInTheDocument()
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
      expect(screen.getByPlaceholderText('e.g. Heat Pump Daikin')).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText('e.g. Heat Pump Daikin')
    const modelInput = screen.getByPlaceholderText('e.g. EHVH08S23EJ6V')
    const serialInput = screen.getByPlaceholderText('e.g. DK-90812903-HP')
    const locationInput = screen.getByPlaceholderText('e.g. Basement / Utility Room')

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

    const stepTitleInputs = screen.getAllByPlaceholderText('e.g. Replace Air Filter')
    expect(stepTitleInputs).toHaveLength(2)
  })

  it('submits form and triggers onClose on success', async () => {
    const handleClose = vi.fn()
    renderWithProviders(<AddDeviceWizard onClose={handleClose} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. Heat Pump Daikin')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('e.g. Heat Pump Daikin'), { target: { value: 'Fridge' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. EHVH08S23EJ6V'), { target: { value: 'FR-500' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. DK-90812903-HP'), { target: { value: 'SN-111' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Basement / Utility Room'), { target: { value: 'Kitchen' } })

    const stepTitleInput = screen.getByPlaceholderText('e.g. Replace Air Filter')
    fireEvent.change(stepTitleInput, { target: { value: 'Inspect coils' } })

    const registerButton = screen.getByRole('button', { name: 'Register Device' })
    fireEvent.click(registerButton)

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
  it('labels required fields once and lets each step be removed with an accessible button', () => {
    renderWithProviders(<AddDeviceWizard onClose={vi.fn()} />)

    expect(screen.getByText('Name *')).toBeInTheDocument()
    expect(screen.queryByText('Name * *')).not.toBeInTheDocument()

    expect(screen.queryByRole('button', { name: /Remove step/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Add Step'))
    const removeButtons = screen.getAllByRole('button', { name: /^Remove step: Step \d$/ })
    expect(removeButtons).toHaveLength(2)

    fireEvent.click(removeButtons[0])
    expect(screen.getAllByPlaceholderText('e.g. Replace Air Filter')).toHaveLength(1)
  })

  it('shows translated category and status options but stores the stable identifiers', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post('*/devices', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 3 }, { status: 201 })
      })
    )
    renderWithProviders(<AddDeviceWizard onClose={vi.fn()} />, { locale: 'de' })

    const category = screen.getByLabelText('Kategorie') as HTMLSelectElement
    expect(Array.from(category.options).map((o) => o.textContent)).toEqual([
      'Heizung & Klima',
      'Sanitär',
      'Elektrik',
      'Haushaltsgeräte',
      'Sicherheit',
      'Garten',
    ])
    expect(Array.from((screen.getByLabelText('Status') as HTMLSelectElement).options).map((o) => o.textContent)).toEqual([
      'Aktiv',
      'In Wartung',
      'Inaktiv',
    ])

    fireEvent.change(category, { target: { value: 'Plumbing' } })
    fireEvent.change(screen.getByPlaceholderText('z.B. Wärmepumpe Daikin'), { target: { value: '  Boiler  ' } })
    fireEvent.change(screen.getByPlaceholderText('z.B. EHVH08S23EJ6V'), { target: { value: 'B-1' } })
    fireEvent.change(screen.getByPlaceholderText('z.B. DK-90812903-HP'), { target: { value: 'S-1' } })
    fireEvent.change(screen.getByPlaceholderText('z.B. Keller / Technikraum'), { target: { value: 'Keller' } })
    fireEvent.change(screen.getByPlaceholderText('z.B. Luftfilter wechseln'), { target: { value: '  Entkalken ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gerät registrieren' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toMatchObject({
      name: 'Boiler',
      category: 'Plumbing',
      status: 'active',
      steps: [{ title: 'Entkalken' }],
    })
  })

  it('does not submit when a required field only contains whitespace', async () => {
    let called = false
    server.use(
      http.post('*/devices', () => {
        called = true
        return HttpResponse.json({ id: 3 }, { status: 201 })
      })
    )
    renderWithProviders(<AddDeviceWizard onClose={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Heat Pump Daikin'), { target: { value: '   ' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. EHVH08S23EJ6V'), { target: { value: 'M' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. DK-90812903-HP'), { target: { value: 'S' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Basement / Utility Room'), { target: { value: 'L' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register Device' }))

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(called).toBe(false)
  })

  it('shows a localized error when the device cannot be saved', async () => {
    server.use(http.post('*/devices', () => HttpResponse.json({ detail: 'bad' }, { status: 400 })))
    renderWithProviders(<AddDeviceWizard onClose={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Heat Pump Daikin'), { target: { value: 'N' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. EHVH08S23EJ6V'), { target: { value: 'M' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. DK-90812903-HP'), { target: { value: 'S' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Basement / Utility Room'), { target: { value: 'L' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register Device' }))

    expect(await screen.findByText('Error saving device. Please check the form and try again.')).toBeInTheDocument()
  })
})
