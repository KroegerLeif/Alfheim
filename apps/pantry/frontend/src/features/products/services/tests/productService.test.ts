import { renderHook, waitFor } from '@testing-library/react'
import {
  useSearchProducts, useProductByBarcode, useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, productKeys,
} from '../productService'
import { createQueryWrapper } from '@/tests/utils'
import { pantryClient } from '@/core/api'
import { vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

vi.mock('@/core/api', () => ({
  pantryClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
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
      expect(pantryClient.get).toHaveBeenCalledWith('api/v1/products', { searchParams: { limit: 100, offset: 0 } })
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

  describe('useUpdateProduct', () => {
    it('patches the product and refreshes products and inventory', async () => {
      const payload = { name: 'Oat Milk', minimum_stock: 3 }
      vi.mocked(pantryClient.patch).mockReturnValue({ json: vi.fn().mockResolvedValue({ id: 'p1', ...payload }) } as any)
      const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

      const { result } = renderHook(() => useUpdateProduct(), { wrapper: createQueryWrapper() })
      result.current.mutate({ id: 'p1', payload })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(pantryClient.patch).toHaveBeenCalledWith('api/v1/products/p1', { json: payload })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: productKeys.all })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventory'] })
      invalidateSpy.mockRestore()
    })
  })

  describe('useDeleteProduct', () => {
    it('deletes the product and refreshes the catalog', async () => {
      vi.mocked(pantryClient.delete).mockResolvedValue({} as any)
      const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

      const { result } = renderHook(() => useDeleteProduct(), { wrapper: createQueryWrapper() })
      result.current.mutate('p1')

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(pantryClient.delete).toHaveBeenCalledWith('api/v1/products/p1')
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: productKeys.all })
      invalidateSpy.mockRestore()
    })
  })
})
