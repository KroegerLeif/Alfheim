import { renderHook, waitFor } from '@testing-library/react'
import { useCategories } from '../categoryService'
import { createQueryWrapper } from '@/tests/utils'
import { pantryClient } from '@/core/api'
import { vi } from 'vitest'

vi.mock('@/core/api', () => ({
  pantryClient: {
    get: vi.fn(),
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
    expect(pantryClient.get).toHaveBeenCalledWith('api/v1/categories')
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
})
