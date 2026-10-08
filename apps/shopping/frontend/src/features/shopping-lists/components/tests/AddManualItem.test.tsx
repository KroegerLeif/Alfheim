import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { AddManualItem } from '../AddManualItem'
import { createQueryWrapper } from '@/tests/utils'
import { server } from '@/tests/mocks/server'
import { makeItem } from '@/tests/mocks/handlers'
import { setTestLocale } from '@/tests/locale'

const LIST_ID = '11111111-1111-4111-a111-111111111111'

describe('AddManualItem', () => {
  it('has no icon picker because the backend does not store item icons', () => {
    render(<AddManualItem listId={LIST_ID} />, { wrapper: createQueryWrapper() })
    expect(screen.queryByRole('button', { name: /icon/i })).not.toBeInTheDocument()
  })

  it('sends only the fields the backend stores, with the default unit code', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/v1/shopping-lists/:id/items', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeItem({ ...body, id: '12121212-1212-4121-a121-121212121212' }), { status: 201 })
      })
    )
    render(<AddManualItem listId={LIST_ID} />, { wrapper: createQueryWrapper() })

    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: '  Oat Milk ' } })
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }))

    await waitFor(() => expect(body).toEqual({ name: 'Oat Milk', quantity: 3, unit: 'stk' }))
    await waitFor(() => expect(screen.getByLabelText('Item name')).toHaveValue(''))
  })

  it('shows unit labels in the active locale and stores the stable unit code', async () => {
    setTestLocale('de')
    let body: Record<string, unknown> = {}
    server.use(
      http.post('*/api/v1/shopping-lists/:id/items', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(makeItem({ ...body }), { status: 201 })
      })
    )
    render(<AddManualItem listId={LIST_ID} />, { wrapper: createQueryWrapper() })

    const picker = screen.getByRole('button', { name: 'Einheit' })
    expect(picker).toHaveTextContent('Stk')
    fireEvent.click(picker)
    fireEvent.click(await screen.findByRole('button', { name: 'Fl.' }))
    expect(screen.getByRole('button', { name: 'Einheit' })).toHaveTextContent('Fl.')

    fireEvent.change(screen.getByLabelText('Artikelname'), { target: { value: 'Wasser' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }))

    await waitFor(() => expect(body.unit).toBe('fl.'))
  })

  it('offers English labels for the same codes', async () => {
    render(<AddManualItem listId={LIST_ID} />, { wrapper: createQueryWrapper() })

    const picker = screen.getByRole('button', { name: 'Unit' })
    expect(picker).toHaveTextContent('pcs')
    fireEvent.click(picker)
    for (const label of ['btl.', 'pack', 'bunch', 'can', 'pkt.']) {
      expect(await screen.findByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Stk' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bund' })).not.toBeInTheDocument()
  })

  it('does not submit an empty name', () => {
    render(<AddManualItem listId={LIST_ID} />, { wrapper: createQueryWrapper() })
    expect(screen.getByRole('button', { name: 'Add Item' })).toHaveClass('pointer-events-none')
  })
})
