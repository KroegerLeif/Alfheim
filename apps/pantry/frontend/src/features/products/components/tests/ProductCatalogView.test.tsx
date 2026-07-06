import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProductCatalogView } from '../ProductCatalogView'
import { useProducts, useSearchProducts, useCreateProduct } from '../../services/productService'
import { useCategories } from '@/features/categories/services/categoryService'
import { createQueryWrapper } from '@/tests/utils'
import { vi, Mock } from 'vitest'

vi.mock('../../services/productService', () => ({
  useProducts: vi.fn(),
  useSearchProducts: vi.fn(),
  useCreateProduct: vi.fn(),
}))

vi.mock('@/features/categories/services/categoryService', () => ({
  useCategories: vi.fn(),
}))

describe('ProductCatalogView Component', () => {
  const mockProducts = [
    { id: '1', name: 'Apples', brand: 'Farmer', barcode: '111', base_unit: 'piece', minimum_stock: 5, category_id: 'cat1', is_global: true },
    { id: '2', name: 'Milk', brand: 'Dairy', barcode: '222', base_unit: 'ml', minimum_stock: 1000, category_id: 'cat2', is_global: false },
  ]

  const mockCategories = [
    { id: 'cat1', name: 'Fruits', description: 'Fresh Fruits', is_global: true },
    { id: 'cat2', name: 'Dairy Products', description: 'Dairy', is_global: false },
  ]

  const mockMutate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    ;(useProducts as Mock).mockReturnValue({ data: mockProducts, isLoading: false })
    ;(useSearchProducts as Mock).mockReturnValue({ data: [], isLoading: false })
    ;(useCategories as Mock).mockReturnValue({ data: mockCategories, isLoading: false })
    ;(useCreateProduct as Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    })
  })

  it('renders the title and subtitles', () => {
    render(<ProductCatalogView />, { wrapper: createQueryWrapper() })
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('subtitle')).toBeInTheDocument()
  })

  it('renders list of product blueprints with categories and details', () => {
    render(<ProductCatalogView />, { wrapper: createQueryWrapper() })

    expect(screen.getByText('Apples')).toBeInTheDocument()
    expect(screen.getByText('Fruits')).toBeInTheDocument()
    expect(screen.getByText('Milk')).toBeInTheDocument()
    expect(screen.getByText('Dairy Products')).toBeInTheDocument()
  })

  it('filters product list when search input is typed in', async () => {
    ;(useSearchProducts as Mock).mockReturnValue({ data: [mockProducts[0]], isLoading: false })

    render(<ProductCatalogView />, { wrapper: createQueryWrapper() })

    const searchInput = screen.getByPlaceholderText('searchPlaceholder')
    fireEvent.change(searchInput, { target: { value: 'Apples' } })

    // Wait for debounce timeout to resolve hook call
    await waitFor(() => {
      expect(useSearchProducts).toHaveBeenCalledWith('Apples')
    })

    expect(screen.getByText('Apples')).toBeInTheDocument()
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()
  })

  it('validates and submits the Create Product form successfully', async () => {
    render(<ProductCatalogView />, { wrapper: createQueryWrapper() })

    // Fill form
    fireEvent.change(screen.getByLabelText('name *'), { target: { value: 'Potatoes' } })
    fireEvent.change(screen.getByLabelText('brand'), { target: { value: 'Local Farms' } })
    fireEvent.change(screen.getByLabelText('barcode'), { target: { value: '33333' } })
    fireEvent.change(screen.getByLabelText('baseUnit'), { target: { value: 'g' } })
    fireEvent.change(screen.getByLabelText('minStockLabel'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('category'), { target: { value: 'cat1' } })

    // Submit form
    fireEvent.submit(screen.getByRole('button', { name: 'submit' }))

    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'Potatoes',
        brand: 'Local Farms',
        barcode: '33333',
        base_unit: 'g',
        minimum_stock: 500,
        category_id: 'cat1',
        nutrition: null,
      },
      expect.any(Object)
    )
  })

  it('allows barcode to be optional (null) on submission', () => {
    render(<ProductCatalogView />, { wrapper: createQueryWrapper() })

    // Submit product without barcode
    fireEvent.change(screen.getByLabelText('name *'), { target: { value: 'Onions' } })
    fireEvent.submit(screen.getByRole('button', { name: 'submit' }))

    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'Onions',
        brand: null,
        barcode: null,
        base_unit: 'piece',
        minimum_stock: 0,
        category_id: null,
        nutrition: null,
      },
      expect.any(Object)
    )
  })
})
