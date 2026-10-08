import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ItemRow } from '../ItemRow'
import { createQueryWrapper } from '@/tests/utils'
import { setTestLocale } from '@/tests/locale'

describe('ItemRow Component', () => {
  const mockItem = {
    id: 'h1',
    list_id: 'list1',
    name: 'Vollmilch',
    brand: 'Bio',
    barcode: '123456',
    quantity: 2,
    unit: 'L',
    is_completed: false,
    is_auto_generated: false,
    is_synced: false,
    product_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  it('renders active item details, name, brand, quantity and unit', () => {
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ItemRow
        item={mockItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />,
      { wrapper: createQueryWrapper() }
    )

    // Name + Brand text
    expect(screen.getByText(/Vollmilch/)).toBeInTheDocument()
    expect(screen.getByText(/(Bio)/)).toBeInTheDocument()

    // Quantity + Unit text
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('L')).toBeInTheDocument()

    // No pantry badge since product_id is null
    expect(screen.queryByText('Pantry')).not.toBeInTheDocument()
  })

  it('displays line-through typography when item is completed', () => {
    const completedItem = { ...mockItem, is_completed: true }
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ItemRow
        item={completedItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />,
      { wrapper: createQueryWrapper() }
    )

    const textNode = screen.getByText(/Vollmilch/)
    expect(textNode).toHaveClass('line-through')
  })

  it('renders the Pantry badge when item has a product_id mapping', () => {
    const linkedItem = { ...mockItem, product_id: 'pantry-uuid-123' }
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ItemRow
        item={linkedItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />,
      { wrapper: createQueryWrapper() }
    )

    expect(screen.getByText('Pantry')).toBeInTheDocument()
  })

  it('calls onToggle callback when clicking the row', () => {
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()

    render(
      <ItemRow
        item={mockItem}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />,
      { wrapper: createQueryWrapper() }
    )

    const row = screen.getByText(/Vollmilch/).closest('div')
    expect(row).toBeInTheDocument()
    fireEvent.click(row!)

    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it('shows the unit in the active locale while the stored code stays the same', () => {
    setTestLocale('de')
    render(<ItemRow item={{ ...mockItem, unit: 'fl.' }} onToggle={vi.fn()} onDelete={vi.fn()} />, {
      wrapper: createQueryWrapper(),
    })
    expect(screen.getByText('Fl.')).toBeInTheDocument()

    setTestLocale('en')
    render(<ItemRow item={{ ...mockItem, id: 'h2', unit: 'fl.' }} onToggle={vi.fn()} onDelete={vi.fn()} />, {
      wrapper: createQueryWrapper(),
    })
    expect(screen.getByText('btl.')).toBeInTheDocument()
  })

  it('shows a unit it does not know as stored', () => {
    render(<ItemRow item={{ ...mockItem, unit: 'sack' }} onToggle={vi.fn()} onDelete={vi.fn()} />, {
      wrapper: createQueryWrapper(),
    })
    expect(screen.getByText('sack')).toBeInTheDocument()
  })

  it('blocks toggling and deleting while the item is only an optimistic copy', () => {
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()
    render(<ItemRow item={mockItem} onToggle={handleToggle} onDelete={handleDelete} isOptimistic />, {
      wrapper: createQueryWrapper(),
    })

    const checkbox = screen.getByRole('button', { name: 'Mark as checked' })
    expect(checkbox).toBeDisabled()
    fireEvent.click(checkbox)
    // Clicking the row itself must not reach the server either.
    fireEvent.click(screen.getByText(/Vollmilch/))
    fireEvent.mouseEnter(screen.getByText(/Vollmilch/).closest('div')!)

    expect(handleToggle).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Remove item' })).not.toBeInTheDocument()
    expect(handleDelete).not.toHaveBeenCalled()
  })

  it('deletes through the localized remove button without toggling the row', () => {
    const handleToggle = vi.fn()
    const handleDelete = vi.fn()
    render(<ItemRow item={{ ...mockItem, is_completed: true }} onToggle={handleToggle} onDelete={handleDelete} />, {
      wrapper: createQueryWrapper(),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Remove item' }))

    expect(handleDelete).toHaveBeenCalledTimes(1)
    expect(handleToggle).not.toHaveBeenCalled()
  })

  it('truncates very long names, brands and quantities instead of overflowing the row', () => {
    const name = 'Superlongproductname'.repeat(20)
    const brand = 'Brand'.repeat(30)
    const { container } = render(
      <ItemRow
        item={{ ...mockItem, name, brand, quantity: 123456789.123456, unit: 'Packung'.repeat(10) }}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: createQueryWrapper() }
    )

    const title = screen.getByTitle(`${name} (${brand})`)
    expect(title).toHaveClass('truncate', 'min-w-0')

    // The name column must be allowed to shrink below its content width.
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toContain('minmax(0,1fr)')
    expect(screen.getByText('123456789.123456')).toHaveClass('truncate')
    expect(screen.getByText('Packung'.repeat(10))).toHaveClass('truncate')
  })
})
