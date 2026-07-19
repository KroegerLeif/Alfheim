import { renderHook, waitFor } from '@testing-library/react'
import { useSearchProducts, useProductByBarcode, useProducts, useCreateProduct, productKeys } from '../productService'
import { createQueryWrapper } from '@/tests/utils'
import { pantryClient } from '@/lib/api'
import { vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

vi.mock('@/lib/api', () => ({
  pantryClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('Product Service Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useSearchProducts', () => {
    it('fetches search results correctly when search term is provided', async () => {
      const mockProducts = [{ id: 'p1', name: 'Apple', brand: 'Fuji', barcode: '123', base_unit: 'piece', minimum_stock: 5 }]
      const mockJson = vi.fn().mockResolvedValue(mockProducts)
      vi.mocked(pantryClient.get).mockReturnValue({
        json: mockJson,
      } as any)

      const { result } = renderHook(() => useSearchProducts('Apple'), {
        wrapper: createQueryWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockProducts)
      expect(pantryClient.get).toHaveBeenCalledWith('api/v1/products', {
        searchParams: { name: 'Apple', limit: 20 },
      })
    })

    it('remains disabled if name is empty or undefined', () => {
      const { result } = renderHook(() => useSearchProducts(''), {
        wrapper: createQueryWrapper(),
      })
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('useProductByBarcode', () => {
    it('fetches product by barcode correctly', async () => {
      const mockProduct = { id: 'p1', name: 'Banana', brand: 'Chiquita', barcode: '456', base_unit: 'piece', minimum_stock: 2 }
      const mockJson = vi.fn().mockResolvedValue(mockProduct)
      vi.mocked(pantryClient.get).mockReturnValue({
        json: mockJson,
      } as any)

      const { result } = renderHook(() => useProductByBarcode('456'), {
        wrapper: createQueryWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockProduct)
      expect(pantryClient.get).toHaveBeenCalledWith('api/v1/products/barcode/456')
    })
  })

  describe('useProducts', () => {
    it('retrieves all products', async () => {
      const mockProducts = [
        { id: 'p1', name: 'Apple', brand: 'Fuji', barcode: '123', base_unit: 'piece', minimum_stock: 5 },
        { id: 'p2', name: 'Banana', brand: 'Chiquita', barcode: '456', base_unit: 'piece', minimum_stock: 2 },
      ]
      const mockJson = vi.fn().mockResolvedValue(mockProducts)
      vi.mocked(pantryClient.get).mockReturnValue({
        json: mockJson,
      } as any)

      const { result } = renderHook(() => useProducts(), {
        wrapper: createQueryWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockProducts)
      expect(pantryClient.get).toHaveBeenCalledWith('api/v1/products')
    })
  })

  describe('useCreateProduct', () => {
    it('creates product and invalidates all product queries', async () => {
      const newProduct = { name: 'Potato', brand: 'Local', base_unit: 'g', minimum_stock: 1000 }
      const mockProductRead = { id: 'p3', ...newProduct, barcode: null, category_id: null, is_global: false, home_id: 'h1', created_at: 'now', updated_at: 'now' }
      const mockJson = vi.fn().mockResolvedValue(mockProductRead)
      vi.mocked(pantryClient.post).mockReturnValue({
        json: mockJson,
      } as any)

      const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

      const { result } = renderHook(() => useCreateProduct(), {
        wrapper: createQueryWrapper(),
      })

      result.current.mutate(newProduct)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockProductRead)
      expect(pantryClient.post).toHaveBeenCalledWith('api/v1/products', { json: newProduct })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: productKeys.all })
      
      invalidateSpy.mockRestore()
    })
  })
})
