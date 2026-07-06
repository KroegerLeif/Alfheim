import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LocationsGridView } from '../LocationsGridView'
import { useLocations, useCreateLocation } from '../../services/locationService'
import { useInventoryState, useLowStockItems } from '@/features/inventory/services/inventoryService'
import { createQueryWrapper } from '@/tests/utils'
import { vi, Mock } from 'vitest'

vi.mock('../../services/locationService', () => ({
  useLocations: vi.fn(),
  useCreateLocation: vi.fn(),
}))

vi.mock('@/features/inventory/services/inventoryService', () => ({
  useInventoryState: vi.fn(),
  useLowStockItems: vi.fn(),
}))

describe('LocationsGridView Component', () => {
  const mockLocations = [
    { id: 'loc-1', name: 'Keller Shelf A', description: 'Cold basement shelf', is_system: false },
    { id: 'loc-2', name: 'Fridge K1', description: 'Kitchen refrigerator', is_system: true },
    { id: 'loc-3', name: 'Pantry Rack', description: 'Dry goods storage', is_system: false },
  ]

  const mockInventoryStates = [
    // loc-1 has 1 expired item
    { id: 's1', product_id: 'p1', location_id: 'loc-1', quantity: 2, expiration_date: '2020-01-01' },
    // loc-2 has 1 low stock item (product p2)
    { id: 's2', product_id: 'p2', location_id: 'loc-2', quantity: 1, expiration_date: '2099-12-31' },
    // loc-3 has no issues
    { id: 's3', product_id: 'p3', location_id: 'loc-3', quantity: 10, expiration_date: '2099-12-31' },
  ]

  const mockLowStockItems = [
    { product: { id: 'p2', name: 'Milk', minimum_stock: 5 }, current_stock: 1 },
  ]

  const mockMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    ;(useLocations as Mock).mockReturnValue({ data: mockLocations, isLoading: false })
    ;(useInventoryState as Mock).mockReturnValue({ data: mockInventoryStates, isLoading: false })
    ;(useLowStockItems as Mock).mockReturnValue({ data: mockLowStockItems, isLoading: false })
    ;(useCreateLocation as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    })
  })

  it('renders title, description and storage locations cards', () => {
    render(<LocationsGridView />, { wrapper: createQueryWrapper() })

    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('subtitle')).toBeInTheDocument()

    expect(screen.getByText('Keller Shelf A')).toBeInTheDocument()
    expect(screen.getByText('Cold basement shelf')).toBeInTheDocument()
    expect(screen.getByText('Fridge K1')).toBeInTheDocument()
    expect(screen.getByText('system')).toBeInTheDocument() // System Fallback badge
  })

  it('calculates warning badges for each card correctly', () => {
    render(<LocationsGridView />, { wrapper: createQueryWrapper() })

    // Keller Shelf A has 1 expired item (2020-01-01 <= today)
    expect(screen.getByText(/1 mhd/i)).toBeInTheDocument()

    // Fridge K1 has 1 low stock item (product p2)
    expect(screen.getByText(/1 knapp/i)).toBeInTheDocument()

    // Pantry Rack has no issues
    expect(screen.getByText(/ok/i)).toBeInTheDocument()
  })

  it('toggles the inline creation form', () => {
    render(<LocationsGridView />, { wrapper: createQueryWrapper() })

    const toggleBtn = screen.getByRole('button', { name: 'createBtn' })
    
    // Form should be closed initially
    expect(screen.queryByLabelText('name *')).not.toBeInTheDocument()

    // Click to open
    fireEvent.click(toggleBtn)
    expect(screen.getByLabelText('name *')).toBeInTheDocument()
    expect(screen.getByLabelText('description')).toBeInTheDocument()

    // Click to close
    fireEvent.click(screen.getByRole('button', { name: 'createBtnClose' }))
    expect(screen.queryByLabelText('name *')).not.toBeInTheDocument()
  })

  it('submits creation form and triggers useCreateLocation mutation', () => {
    render(<LocationsGridView />, { wrapper: createQueryWrapper() })

    // Open form
    fireEvent.click(screen.getByRole('button', { name: 'createBtn' }))

    // Fill form
    fireEvent.change(screen.getByLabelText('name *'), { target: { value: 'Cabinet B' } })
    fireEvent.change(screen.getByLabelText('description'), { target: { value: 'High cabinet' } })

    // Submit
    fireEvent.submit(screen.getByRole('button', { name: 'submit' }))

    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'Cabinet B',
        description: 'High cabinet',
      },
      expect.any(Object)
    )
  })
})
