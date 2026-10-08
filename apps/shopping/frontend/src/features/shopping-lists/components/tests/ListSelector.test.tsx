import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import { ListSelector } from '../ListSelector'
import { createQueryWrapper } from '@/tests/utils'

const LIST_1_ID = '11111111-1111-4111-a111-111111111111'
const LIST_2_ID = '22222222-2222-4222-a222-222222222222'
const LIST_NEW_ID = '66666666-6666-4666-a666-666666666666'

describe('ListSelector Component', () => {
  it('passes accessibility audit', async () => {
    const handleSelect = vi.fn()
    const { container } = render(
      <ListSelector activeListId={LIST_1_ID} onSelect={handleSelect} />,
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => {
      expect(screen.getByText('Party Supplies')).toBeInTheDocument()
    })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders shopping lists and triggers onSelect when clicking a list tab', async () => {
    const handleSelect = vi.fn()
    render(
      <ListSelector activeListId={LIST_1_ID} onSelect={handleSelect} />,
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => {
      expect(screen.getByText('Party Supplies')).toBeInTheDocument()
    })

    const partyListTab = screen.getByText('Party Supplies')
    fireEvent.click(partyListTab)

    expect(handleSelect).toHaveBeenCalledWith(LIST_2_ID)
  })

  it('allows opening inline creation form and creating a new list', async () => {
    const handleSelect = vi.fn()
    render(
      <ListSelector activeListId={LIST_1_ID} onSelect={handleSelect} />,
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => {
      expect(screen.getByText('Party Supplies')).toBeInTheDocument()
    })

    // Click '+' button to open inline creation input
    const addButton = screen.getByRole('button', { name: 'New List' })
    fireEvent.click(addButton)

    const input = screen.getByPlaceholderText('Name...')
    expect(input).toBeInTheDocument()

    // Type name and confirm
    fireEvent.change(input, { target: { value: 'Camping Items' } })

    // Find green check confirm button
    const checkBtn = input.nextElementSibling as HTMLElement
    fireEvent.click(checkBtn)

    await waitFor(() => {
      expect(handleSelect).toHaveBeenCalledWith(LIST_NEW_ID)
    })
  })

  it('allows canceling inline list creation', async () => {
    const handleSelect = vi.fn()
    render(
      <ListSelector activeListId={LIST_1_ID} onSelect={handleSelect} />,
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => {
      expect(screen.getByText('Party Supplies')).toBeInTheDocument()
    })

    const addButton = screen.getByRole('button', { name: 'New List' })
    fireEvent.click(addButton)

    const input = screen.getByPlaceholderText('Name...')
    fireEvent.change(input, { target: { value: 'Draft List' } })

    // Find cancel X button
    const cancelBtn = input.nextElementSibling?.nextElementSibling as HTMLElement
    fireEvent.click(cancelBtn)

    expect(screen.queryByPlaceholderText('Name...')).not.toBeInTheDocument()
  })

  describe('protected lists', () => {
    const now = new Date().toISOString()
    const baseList = {
      home_id: '33333333-3333-4333-a333-333333333333',
      owner_id: '44444444-4444-4444-a444-444444444444',
      position: 0,
      items: [],
      created_at: now,
      updated_at: now,
    }

    it('relies on the is_personal flag, not on the list name', async () => {
      server.use(
        http.get('*/api/v1/shopping-lists', () =>
          HttpResponse.json([
            { ...baseList, id: LIST_1_ID, name: 'anna - Liste', is_default: false, is_personal: true },
            { ...baseList, id: LIST_2_ID, name: "John's List", is_default: false, is_personal: false },
            {
              ...baseList,
              id: '77777777-7777-4777-a777-777777777778',
              name: 'Lista Extra',
              is_default: false,
              is_personal: false,
            },
          ])
        )
      )
      render(<ListSelector activeListId={LIST_2_ID} onSelect={vi.fn()} />, { wrapper: createQueryWrapper() })

      // Custom lists keep their own name even when it looks like a personal list name.
      expect(await screen.findByText("John's List")).toBeInTheDocument()
      expect(screen.getByText('Lista Extra')).toBeInTheDocument()
      // The flagged list is shown as the personal list.
      expect(screen.getByText('Personal List')).toBeInTheDocument()
      expect(screen.queryByText('anna - Liste')).not.toBeInTheDocument()
      // The active custom list can be deleted although its name ends in "'s List".
      expect(screen.getByRole('button', { name: 'Delete list' })).toBeInTheDocument()
    })

    it('does not offer to delete the personal list', async () => {
      server.use(
        http.get('*/api/v1/shopping-lists', () =>
          HttpResponse.json([{ ...baseList, id: LIST_1_ID, name: 'anna - Liste', is_default: false, is_personal: true }])
        )
      )
      render(<ListSelector activeListId={LIST_1_ID} onSelect={vi.fn()} />, { wrapper: createQueryWrapper() })

      expect(await screen.findByText('Personal List')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete list' })).not.toBeInTheDocument()
    })

    it('truncates very long list names in the tab', async () => {
      const longName = 'Wochenendeinkauf für die ganze Familie '.repeat(8).trim()
      server.use(
        http.get('*/api/v1/shopping-lists', () =>
          HttpResponse.json([{ ...baseList, id: LIST_2_ID, name: longName, is_default: false, is_personal: false }])
        )
      )
      render(<ListSelector activeListId={LIST_2_ID} onSelect={vi.fn()} />, { wrapper: createQueryWrapper() })

      const label = await screen.findByText(longName)
      expect(label).toHaveClass('truncate')
      expect(label).toHaveAttribute('title', longName)
    })
  })
})
