import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DashboardHeader } from '../DashboardHeader'
import { createQueryWrapper } from '@/tests/utils'
import type { ShoppingList } from '../../types'

const now = new Date().toISOString()
const baseList: ShoppingList = {
  id: '11111111-1111-4111-a111-111111111111',
  name: 'Weekly',
  home_id: '33333333-3333-4333-a333-333333333333',
  owner_id: '44444444-4444-4444-a444-444444444444',
  is_default: false,
  is_personal: false,
  position: 0,
  created_at: now,
  updated_at: now,
  items: [],
}

function renderHeader(list: ShoppingList | undefined, overrides: Partial<React.ComponentProps<typeof DashboardHeader>> = {}) {
  const props = {
    activeList: list,
    username: 'anna',
    households: [{ id: baseList.home_id, name: 'Family Home', is_default: true }],
    checkedCount: 1,
    totalCount: 4,
    onSync: vi.fn(),
    onClearCompleted: vi.fn(),
    isSyncPending: false,
    ...overrides,
  } as React.ComponentProps<typeof DashboardHeader>
  const { container } = render(<DashboardHeader {...props} />, { wrapper: createQueryWrapper() })
  return { ...props, container }
}

describe('DashboardHeader', () => {
  it('shows a custom list under its own name even if it looks like a personal list name', () => {
    renderHeader({ ...baseList, name: "John's List" })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("John's List")
    expect(screen.getByText('Custom List')).toBeInTheDocument()
  })

  it('shows the personal list only for the is_personal flag', () => {
    renderHeader({ ...baseList, name: 'anna - Liste', is_personal: true })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("anna's List")
  })

  it('shows the household name for the household list', () => {
    renderHeader({ ...baseList, name: 'Haushalt', is_default: true })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Family Home')
  })

  it('draws the progress without an inline svg', () => {
    const { container } = renderHeader(baseList)
    const bar = screen.getByRole('progressbar', { name: 'Progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '25')
    // Lucide icons are fine; the hand-drawn 36x36 progress ring is gone.
    expect(container.querySelector('svg[viewBox="0 0 36 36"]')).toBeNull()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('shows the sync button only when items are checked and triggers the sync', () => {
    const props = renderHeader(baseList)
    fireEvent.click(screen.getByRole('button', { name: /Pantry Transfer/ }))
    expect(props.onSync).toHaveBeenCalledTimes(1)
  })

  it('hides the sync and clear buttons when nothing is checked', () => {
    renderHeader(baseList, { checkedCount: 0 })
    expect(screen.queryByRole('button', { name: /Pantry Transfer/ })).not.toBeInTheDocument()
    expect(screen.queryByTitle('Clear Completed')).not.toBeInTheDocument()
  })

  it('confirms a copied link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderHeader(baseList)

    fireEvent.click(screen.getByTitle('Share'))

    expect(await screen.findByText(/Link copied to clipboard!/)).toBeInTheDocument()
    expect(writeText).toHaveBeenCalled()
  })

  it('reports a failed copy instead of ignoring it', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderHeader(baseList)

    fireEvent.click(screen.getByTitle('Share'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy the link.')
    await waitFor(() => expect(screen.queryByText(/Link copied/)).not.toBeInTheDocument())
  })

  it('truncates a very long list name', () => {
    const name = 'Grillparty am Wochenende mit der ganzen Nachbarschaft '.repeat(6).trim()
    renderHeader({ ...baseList, name })
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveClass('truncate')
    expect(heading).toHaveAttribute('title', name)
  })
})
