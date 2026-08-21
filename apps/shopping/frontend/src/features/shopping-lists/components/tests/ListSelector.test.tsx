import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { ListSelector } from '../ListSelector'
import { createQueryWrapper } from '@/tests/utils'

const LIST_1_ID = '11111111-1111-4111-a111-111111111111'
const LIST_2_ID = '22222222-2222-4222-a222-222222222222'
const LIST_NEW_ID = '66666666-6666-4666-a666-666666666666'

// Mock next-intl translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    if (key === 'newListPlaceholder') return 'New list name'
    if (key === 'household_list_fallback') return 'Main Household'
    return key
  },
}))

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
    const addButton = screen.getByTitle('New list name')
    fireEvent.click(addButton)

    const input = screen.getByPlaceholderText('New list name')
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

    const addButton = screen.getByTitle('New list name')
    fireEvent.click(addButton)

    const input = screen.getByPlaceholderText('New list name')
    fireEvent.change(input, { target: { value: 'Draft List' } })

    // Find cancel X button
    const cancelBtn = input.nextElementSibling?.nextElementSibling as HTMLElement
    fireEvent.click(cancelBtn)

    expect(screen.queryByPlaceholderText('New list name')).not.toBeInTheDocument()
  })
})
