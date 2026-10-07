import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { MaintenanceMode } from '../MaintenanceMode'
import { renderWithProviders } from '../../../../tests/test-utils'
import { server } from '../../../../tests/mocks/server'
import { CART_STORAGE_KEY } from '../../../shopping/hooks/useCart'
import { Device } from '@/shared/types'

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
    household_id: '33333333-3333-4333-a333-333333333333',
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
    household_id: '33333333-3333-4333-a333-333333333333',
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
    expect(screen.getByText('This device does not have any service steps configured.')).toBeInTheDocument()

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
    const markDoneBtn = screen.getByRole('button', { name: 'Mark this step as completed' })
    fireEvent.click(markDoneBtn)

    // Type notes into step notes area
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Filter was dirty.' } })
    expect(textarea).toHaveValue('Filter was dirty.')

    // Navigate next
    const nextBtn = screen.getByRole('button', { name: /^Next$/i })
    fireEvent.click(nextBtn)

    // Step 2 details
    expect(screen.getByText('Descale Drum')).toBeInTheDocument()

    // Navigate back
    const backBtn = screen.getByRole('button', { name: /^Back$/i })
    fireEvent.click(backBtn)
    expect(screen.getByText('Clean Drain Pump Filter')).toBeInTheDocument()
  })

  it('allows completing all steps and finishing maintenance', async () => {
    const handleClose = vi.fn()
    renderWithProviders(
      <MaintenanceMode device={mockDeviceWithSteps} onClose={handleClose} />
    )

    // Mark step 1 done
    fireEvent.click(screen.getByRole('button', { name: 'Mark this step as completed' }))

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }))

    // Mark step 2 done
    fireEvent.click(screen.getByRole('button', { name: 'Mark this step as completed' }))

    // Finish button should be enabled
    const finishBtn = screen.getByRole('button', { name: /Finish & Save/i })
    expect(finishBtn).not.toBeDisabled()
    fireEvent.click(finishBtn)

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled()
    })
  })
  describe('submission', () => {
    function captureSubmit() {
      const captured: { body?: Record<string, unknown> } = {}
      server.use(
        http.post('*/maintenance/submit', async ({ request }) => {
          captured.body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({ id: 1 }, { status: 201 })
        })
      )
      return captured
    }

    function completeAllSteps(notes?: string) {
      fireEvent.click(screen.getByRole('button', { name: 'Mark this step as completed' }))
      if (notes) fireEvent.change(screen.getByLabelText('Operation Notes & Comments'), { target: { value: notes } })
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      fireEvent.click(screen.getByRole('button', { name: 'Mark this step as completed' }))
      fireEvent.click(screen.getByRole('button', { name: /Finish & Save/ }))
    }

    it('sends the completed steps, trimmed notes and the localized fallbacks', async () => {
      const captured = captureSubmit()
      renderWithProviders(<MaintenanceMode device={mockDeviceWithSteps} onClose={vi.fn()} />, { locale: 'de' })

      fireEvent.click(screen.getByRole('button', { name: 'Diesen Schritt als erledigt markieren' }))
      fireEvent.change(screen.getByLabelText('Betriebsnotizen & Kommentare'), { target: { value: '  Sieb verschmutzt  ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Weiter' }))
      fireEvent.click(screen.getByRole('button', { name: 'Diesen Schritt als erledigt markieren' }))
      fireEvent.click(screen.getByRole('button', { name: /Abschließen & Speichern/ }))

      await waitFor(() => expect(captured.body).toBeDefined())
      expect(captured.body).toMatchObject({
        device_id: 1,
        completed_step_ids: expect.arrayContaining([101, 102]),
        step_notes: 'Clean Drain Pump Filter: Sieb verschmutzt',
        performer: 'Angemeldeter Benutzer',
        supply_items: null,
      })
    })

    it('falls back to a localized note when no step notes were written', async () => {
      const captured = captureSubmit()
      renderWithProviders(<MaintenanceMode device={mockDeviceWithSteps} onClose={vi.fn()} />)

      completeAllSteps()

      await waitFor(() => expect(captured.body).toBeDefined())
      expect(captured.body?.step_notes).toBe('All service steps inspected and completed.')
      expect(captured.body?.performer).toBe('Authenticated user')
    })

    it('ignores notes that only contain whitespace', async () => {
      const captured = captureSubmit()
      renderWithProviders(<MaintenanceMode device={mockDeviceWithSteps} onClose={vi.fn()} />)

      completeAllSteps('   ')

      await waitFor(() => expect(captured.body).toBeDefined())
      expect(captured.body?.step_notes).toBe('All service steps inspected and completed.')
    })

    it('shows an error and keeps the wizard open when saving fails', async () => {
      server.use(http.post('*/maintenance/submit', () => HttpResponse.json({ detail: 'down' }, { status: 500 })))
      const onClose = vi.fn()
      renderWithProviders(<MaintenanceMode device={mockDeviceWithSteps} onClose={onClose} />)

      completeAllSteps()

      expect(await screen.findByRole('alert')).toHaveTextContent('The maintenance log could not be saved. Please try again.')
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /Finish & Save/ })).not.toBeDisabled()
    })
  })

  describe('supplies', () => {
    it('adds and removes the supply item of the current step and persists the cart', async () => {
      renderWithProviders(<MaintenanceMode device={mockDeviceWithSteps} onClose={vi.fn()} />)

      expect(screen.getByText('Drain Pan')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Select for Cart' }))
      expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')).toEqual(['Drain Pan'])

      fireEvent.click(screen.getByRole('button', { name: 'Remove Cart' }))
      expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')).toEqual([])
    })

    it('sends the cart with the submission and empties it afterwards', async () => {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(['Drain Pan']))
      let body: Record<string, unknown> | undefined
      server.use(
        http.post('*/maintenance/submit', async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>
          return HttpResponse.json({ id: 1 }, { status: 201 })
        })
      )
      const onClose = vi.fn()
      renderWithProviders(<MaintenanceMode device={mockDeviceWithSteps} onClose={onClose} />)

      fireEvent.click(await screen.findByRole('button', { name: 'Remove Cart' }))
      fireEvent.click(screen.getByRole('button', { name: 'Select for Cart' }))
      fireEvent.click(screen.getByRole('button', { name: 'Mark this step as completed' }))
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      fireEvent.click(screen.getByRole('button', { name: 'Mark this step as completed' }))
      fireEvent.click(screen.getByRole('button', { name: /Finish & Save/ }))

      await waitFor(() => expect(onClose).toHaveBeenCalled())
      expect(body?.supply_items).toEqual(['Drain Pan'])
      expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null')).toEqual([])
    })

    it('tells the user when a step needs no part instead of claiming the cart is empty', () => {
      const device: Device = {
        ...mockDeviceWithSteps,
        steps: [{ ...mockDeviceWithSteps.steps[0], supply_item: null }],
      }
      renderWithProviders(<MaintenanceMode device={device} onClose={vi.fn()} />)

      expect(screen.getByText('No part is required for this step.')).toBeInTheDocument()
      expect(screen.queryByText('Your Cart is Empty')).not.toBeInTheDocument()
    })
  })

  it('has no manuals panel because manuals are not supported by the backend', () => {
    renderWithProviders(<MaintenanceMode device={mockDeviceWithSteps} onClose={vi.fn()} />)
    expect(screen.queryByText(/manual/i)).not.toBeInTheDocument()
  })

  it('keeps very long step titles, descriptions and part names wrapped', () => {
    const device: Device = {
      ...mockDeviceWithSteps,
      name: 'D'.repeat(200),
      steps: [
        {
          ...mockDeviceWithSteps.steps[0],
          title: 'Title-'.repeat(60),
          description: 'description_'.repeat(50),
          supply_item: 'Part-'.repeat(60),
        },
      ],
    }
    renderWithProviders(<MaintenanceMode device={device} onClose={vi.fn()} />)

    expect(screen.getByText('Title-'.repeat(60))).toHaveClass('break-words')
    expect(screen.getByText('description_'.repeat(50))).toHaveClass('break-words')
    expect(screen.getByText('Part-'.repeat(60))).toHaveClass('break-words')
    expect(screen.getByText('D'.repeat(200))).toHaveClass('truncate')
  })
})
