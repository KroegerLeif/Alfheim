import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { EinlagernModal } from '../EinlagernModal'
import { createQueryWrapper } from '@/tests/utils'
import { UnrecognizedShoppingItem } from '../../types'

const LIST_ID = '11111111-1111-4111-a111-111111111111'
const ITEM_1_ID = '55555555-5555-4555-a555-555555555555'
const ITEM_2_ID = '88888888-8888-4888-a888-888888888888'

const mockUnrecognizedItems: UnrecognizedShoppingItem[] = [
  {
    shopping_item_id: ITEM_1_ID,
    name: 'Oat Milk',
    brand: 'Oatly',
    barcode: '7350083730007',
    quantity: 2,
    unit: 'L',
    reason: 'Product not in catalog',
  },
  {
    shopping_item_id: ITEM_2_ID,
    name: 'Bio Eggs',
    quantity: 10,
    unit: 'piece',
    reason: 'Product not in catalog',
  },
]

// Mock next-intl translations
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: any) => {
    if (key === 'scanTitle') return 'Scan & Sync'
    if (key === 'unresolvedTitle') return `${params?.count ?? 0} items need review`
    if (key === 'allDoneTitle') return 'All items processed'
    if (key === 'targetHousehold') return 'Target Pantry'
    if (key === 'doneBtn') return 'Complete Sync'
    if (key === 'laterBtn') return 'Process Later'
    if (key === 'close') return 'Close'
    if (key === 'summaryText') return `Saved ${params?.saved}, Skipped ${params?.ignored}`
    return key
  },
}))

describe('EinlagernModal Component', () => {
  it('passes accessibility audit', async () => {
    const handleClose = vi.fn()
    const { container } = render(
      <EinlagernModal
        listId={LIST_ID}
        initialItems={mockUnrecognizedItems}
        onClose={handleClose}
      />,
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => {
      expect(screen.getByText('2 items need review')).toBeInTheDocument()
    })

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders unresolved item count and allows closing modal via close button or later button', async () => {
    const handleClose = vi.fn()
    render(
      <EinlagernModal
        listId={LIST_ID}
        initialItems={mockUnrecognizedItems}
        onClose={handleClose}
      />,
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => {
      expect(screen.getByText('2 items need review')).toBeInTheDocument()
    })

    expect(screen.getByText('Oat Milk')).toBeInTheDocument()
    expect(screen.getByText('Bio Eggs')).toBeInTheDocument()

    const laterBtn = screen.getByRole('button', { name: 'Process Later' })
    fireEvent.click(laterBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('allows skipping and removing unrecognized items until all are resolved', async () => {
    const handleClose = vi.fn()
    render(
      <EinlagernModal
        listId={LIST_ID}
        initialItems={mockUnrecognizedItems}
        onClose={handleClose}
      />,
      { wrapper: createQueryWrapper() }
    )

    await waitFor(() => {
      expect(screen.getByText('2 items need review')).toBeInTheDocument()
    })

    // Skip item 1
    const skipButtons = screen.getAllByTitle('skipItem')
    fireEvent.click(skipButtons[0])

    expect(screen.getByText('1 items need review')).toBeInTheDocument()

    // Skip item 2 as well
    const remainingSkipButtons = screen.getAllByTitle('skipItem')
    fireEvent.click(remainingSkipButtons[0])

    // Now all done title and Complete Sync button should appear
    await waitFor(() => {
      expect(screen.getByText('All items processed')).toBeInTheDocument()
    })

    const completeBtn = screen.getByRole('button', { name: 'Complete Sync' })
    fireEvent.click(completeBtn)

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled()
    })
  })
})
