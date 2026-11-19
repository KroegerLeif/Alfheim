import React from 'react'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../tests/mocks/server'
import { renderWithProviders } from '../../../../tests/test-utils'
import { makeDevice, makeStep } from '../../../../tests/fixtures'
import { DeviceDetailPanel } from '../DeviceDetailPanel'

type Captured = { method: string; path: string; body: unknown }

/** Records every device and step write and answers it like the backend would. */
function captureWrites() {
  const calls: Captured[] = []
  const record = async (request: Request) => {
    const body = request.method === 'DELETE' ? undefined : await request.json()
    calls.push({ method: request.method, path: new URL(request.url).pathname.replace(/^.*\/api\/v1\/maintenance/, ''), body })
    return body
  }
  server.use(
    http.patch('*/devices/:id', async ({ request }) => HttpResponse.json({ ...makeDevice(), ...((await record(request)) as object) })),
    http.delete('*/devices/:id', async ({ request }) => {
      await record(request)
      return new HttpResponse(null, { status: 204 })
    }),
    http.post('*/devices/:id/steps', async ({ request }) => HttpResponse.json(makeStep((await record(request)) as object), { status: 201 })),
    http.patch('*/devices/:id/steps/:stepId', async ({ request }) => HttpResponse.json(makeStep((await record(request)) as object))),
    http.delete('*/devices/:id/steps/:stepId', async ({ request }) => {
      await record(request)
      return new HttpResponse(null, { status: 204 })
    })
  )
  return calls
}

describe('device editing (#505)', () => {
  it('edits the device details', async () => {
    const calls = captureWrites()
    const device = makeDevice({ id: 7, name: 'Boiler', serial: 'SN-1' })
    renderWithProviders(<DeviceDetailPanel device={device} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit device' }))
    const form = screen.getByRole('form', { name: 'Edit device' })
    fireEvent.change(within(form).getByDisplayValue('SN-1'), { target: { value: 'SN-2' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({ method: 'PATCH', path: '/devices/7', body: { name: 'Boiler', serial: 'SN-2' } })
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Edit device' })).toBeNull())
  })

  it('deletes the device only after confirmation and closes the panel', async () => {
    const calls = captureWrites()
    const onClose = vi.fn()
    renderWithProviders(<DeviceDetailPanel device={makeDevice({ id: 7, name: 'Boiler' })} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete device' }))
    expect(calls).toHaveLength(0)
    const confirm = screen.getByRole('alertdialog', { name: 'Delete device' })
    expect(confirm).toHaveTextContent('Delete Boiler with all its maintenance steps')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(calls).toEqual([{ method: 'DELETE', path: '/devices/7', body: undefined }])
  })

  it('cancels a delete without a request', () => {
    const calls = captureWrites()
    renderWithProviders(<DeviceDetailPanel device={makeDevice()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Delete device' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('reports a failed save', async () => {
    server.use(http.patch('*/devices/:id', () => HttpResponse.json({ detail: 'nope' }, { status: 500 })))
    renderWithProviders(<DeviceDetailPanel device={makeDevice()} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit device' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the changes')
  })

  it('hides every edit control from guests', () => {
    renderWithProviders(<DeviceDetailPanel device={makeDevice({ steps: [makeStep({ title: 'Filter' })] })} onClose={vi.fn()} />, {
      householdValue: { role: 'GUEST' },
    })

    expect(screen.queryByRole('button', { name: 'Edit device' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete device' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Steps' }))
    expect(screen.queryByRole('button', { name: 'Add Step' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Edit step/ })).toBeNull()
  })
})

describe('step editing (#505)', () => {
  function openSteps(steps = [makeStep({ id: 3, title: 'Filter', recurrence: 3, description: 'Swap it' })]) {
    renderWithProviders(<DeviceDetailPanel device={makeDevice({ id: 7, steps })} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Steps' }))
  }

  it('adds a step', async () => {
    const calls = captureWrites()
    openSteps([])

    fireEvent.click(screen.getByRole('button', { name: 'Add Step' }))
    const form = screen.getByRole('form', { name: 'Add Step' })
    fireEvent.change(within(form).getByLabelText(/Title/), { target: { value: ' Descale ' } })
    fireEvent.change(within(form).getByLabelText(/Recurrence/), { target: { value: '6' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/devices/7/steps',
      body: { title: 'Descale', description: null, recurrence: 6, supply_item: null },
    })
  })

  it('edits a step', async () => {
    const calls = captureWrites()
    openSteps()

    fireEvent.click(screen.getByRole('button', { name: 'Edit step: Filter' }))
    const form = screen.getByRole('form', { name: 'Edit step' })
    expect(within(form).getByLabelText(/Procedure/)).toHaveValue('Swap it')
    fireEvent.change(within(form).getByLabelText(/Recurrence/), { target: { value: '4' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({ method: 'PATCH', path: '/devices/7/steps/3', body: { title: 'Filter', recurrence: 4 } })
  })

  it('deletes a step after confirmation', async () => {
    const calls = captureWrites()
    openSteps()

    fireEvent.click(screen.getByRole('button', { name: 'Delete step: Filter' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(calls).toEqual([{ method: 'DELETE', path: '/devices/7/steps/3', body: undefined }]))
  })
})
