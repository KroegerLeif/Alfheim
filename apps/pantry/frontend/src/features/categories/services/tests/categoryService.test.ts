import { renderHook, waitFor } from '@testing-library/react'
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../categoryService'
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

describe('useCategories Hook', () => {
  it('fetches and returns categories successfully', async () => {
    const mockCategories = [
      { id: '1', name: 'Drinks', description: 'Beverages', is_global: true },
      { id: '2', name: 'Snacks', description: 'Crunchies', is_global: false },
    ]

    const mockJson = vi.fn().mockResolvedValue(mockCategories)
    vi.mocked(pantryClient.get).mockReturnValue({
      json: mockJson,
    } as any)

    const { result } = renderHook(() => useCategories(), {
      wrapper: createQueryWrapper(),
    })

    // Validate loading state
    expect(result.current.isLoading).toBe(true)

    // Wait for React Query to resolve the hook promise
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockCategories)
    expect(pantryClient.get).toHaveBeenCalledWith('api/v1/categories', { searchParams: { limit: 100, offset: 0 } })
  })

  it('handles errors gracefully when API fetch fails', async () => {
    const apiError = new Error('Network error')
    const mockJson = vi.fn().mockRejectedValue(apiError)
    vi.mocked(pantryClient.get).mockReturnValue({
      json: mockJson,
    } as any)

    const { result } = renderHook(() => useCategories(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(apiError)
  })

  it('creates, renames and deletes categories and refreshes the list each time', async () => {
    vi.mocked(pantryClient.post).mockReturnValue({ json: vi.fn().mockResolvedValue({ id: 'c1', name: 'Baking' }) } as any)
    vi.mocked(pantryClient.patch).mockReturnValue({ json: vi.fn().mockResolvedValue({ id: 'c1', name: 'Bakery' }) } as any)
    vi.mocked(pantryClient.delete).mockResolvedValue({} as any)
    const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

    const create = renderHook(() => useCreateCategory(), { wrapper: createQueryWrapper() })
    create.result.current.mutate({ name: 'Baking' })
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true))
    expect(pantryClient.post).toHaveBeenCalledWith('api/v1/categories', { json: { name: 'Baking' } })

    const update = renderHook(() => useUpdateCategory(), { wrapper: createQueryWrapper() })
    update.result.current.mutate({ id: 'c1', payload: { name: 'Bakery' } })
    await waitFor(() => expect(update.result.current.isSuccess).toBe(true))
    expect(pantryClient.patch).toHaveBeenCalledWith('api/v1/categories/c1', { json: { name: 'Bakery' } })

    const remove = renderHook(() => useDeleteCategory(), { wrapper: createQueryWrapper() })
    remove.result.current.mutate('c1')
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true))
    expect(pantryClient.delete).toHaveBeenCalledWith('api/v1/categories/c1')

    expect(invalidateSpy).toHaveBeenCalledTimes(3)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['categories'] })
    invalidateSpy.mockRestore()
  })
})
