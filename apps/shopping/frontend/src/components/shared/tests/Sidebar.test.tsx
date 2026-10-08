import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Sidebar } from '../Sidebar'
import { createQueryWrapper } from '@/tests/utils'
import { server } from '@/tests/mocks/server'

const now = new Date().toISOString()
const baseList = {
  home_id: '33333333-3333-4333-a333-333333333333',
  owner_id: '44444444-4444-4444-a444-444444444444',
  position: 0,
  items: [],
  created_at: now,
  updated_at: now,
}
const CUSTOM_ID = '22222222-2222-4222-a222-222222222222'

function serveLists(customName: string) {
  server.use(
    http.get('*/api/v1/shopping-lists', () =>
      HttpResponse.json([
        { ...baseList, id: '11111111-1111-4111-a111-111111111111', name: 'Haushalt', is_default: true, is_personal: false },
        { ...baseList, id: '77777777-7777-4777-a777-777777777778', name: 'anna - Liste', is_default: false, is_personal: true },
        { ...baseList, id: CUSTOM_ID, name: customName, is_default: false, is_personal: false },
      ])
    )
  )
}

describe('Sidebar', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the shopping subtitle and the three kinds of lists', async () => {
    serveLists("John's List")
    render(<Sidebar />, { wrapper: createQueryWrapper() })

    // The subtitle must come from the shopping namespace, not from the Pantry navigation entry.
    expect(screen.getByText('Checklist & Stock')).toBeInTheDocument()
    expect(await screen.findByText("John's List")).toBeInTheDocument()
    expect(screen.getByText('Test Household')).toBeInTheDocument()
    expect(screen.getByText('Personal List')).toBeInTheDocument()
  })

  it('truncates a very long custom list name and still offers delete', async () => {
    const name = 'Geburtstagsfeier mit allen Freunden und der Familie '.repeat(5).trim()
    serveLists(name)
    render(<Sidebar />, { wrapper: createQueryWrapper() })

    const label = await screen.findByText(name)
    expect(label).toHaveClass('truncate', 'min-w-0')
    expect(label).toHaveAttribute('title', name)
    expect(screen.getByRole('button', { name: 'Delete list' })).toBeInTheDocument()
  })

  it('asks for confirmation before deleting a custom list and tells the user when it fails', async () => {
    serveLists('Party')
    server.use(
      http.delete('*/api/v1/shopping-lists/:id', () =>
        HttpResponse.json({ detail: { error_code: 'x', message: 'This shopping list is protected and cannot be deleted.' } }, { status: 400 })
      )
    )
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Sidebar />, { wrapper: createQueryWrapper() })

    fireEvent.click(await screen.findByRole('button', { name: 'Delete list' }))

    expect(confirm).toHaveBeenCalledWith('Delete list "Party"?')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the list. This shopping list is protected and cannot be deleted.'
    )
  })

  it('does not delete when the confirmation is declined', async () => {
    serveLists('Party')
    let deleted = false
    server.use(
      http.delete('*/api/v1/shopping-lists/:id', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      })
    )
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Sidebar />, { wrapper: createQueryWrapper() })

    fireEvent.click(await screen.findByRole('button', { name: 'Delete list' }))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(deleted).toBe(false)
  })

  it('creates a list from the inline form and reports a failure', async () => {
    serveLists('Party')
    server.use(
      http.post('*/api/v1/shopping-lists', () => HttpResponse.json({ detail: 'Boom' }, { status: 500 }))
    )
    render(<Sidebar />, { wrapper: createQueryWrapper() })
    await screen.findByText('Party')

    fireEvent.click(screen.getByRole('button', { name: /New List/ }))
    fireEvent.change(screen.getByPlaceholderText('Name...'), { target: { value: 'Camping' } })
    fireEvent.click(screen.getByRole('button', { name: 'New List' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Could not create the list. Boom')
    )
  })

  it('renders in Polish', async () => {
    const { setTestLocale } = await import('@/tests/locale')
    setTestLocale('pl')
    serveLists('Party')
    render(<Sidebar />, { wrapper: createQueryWrapper() })

    expect(screen.getByText('Lista & Zapasy')).toBeInTheDocument()
    expect(await screen.findByText('Party')).toBeInTheDocument()
    expect(screen.getByText('Listy domowe')).toBeInTheDocument()
  })
})
