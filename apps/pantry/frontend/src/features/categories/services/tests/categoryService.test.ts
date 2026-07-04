import { renderHook, waitFor } from '@testing-library/react'
import { useCategories } from '../categoryService'
import { createQueryWrapper } from '@/tests/utils'
import { apiClient } from '@/lib/api'
import { vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

describe('useCategories Hook', () => {
  it('fetches and returns categories successfully', async () => {
    const mockCategories = [
      { id: '1', name: 'Drinks', description: 'Beverages', is_global: true },
      { id: '2', name: 'Snacks', description: 'Crunchies', is_global: false },
    ]
    
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockCategories })

    const { result } = renderHook(() => useCategories(), {
      wrapper: createQueryWrapper(),
    })

    // Validate loading state
    expect(result.current.isLoading).toBe(true)

    // Wait for React Query to resolve the hook promise
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(mockCategories)
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/categories')
  })

  it('handles errors gracefully when API fetch fails', async () => {
    const apiError = new Error('Network error')
    vi.mocked(apiClient.get).mockRejectedValue(apiError)

    const { result } = renderHook(() => useCategories(), {
      wrapper: createQueryWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(apiError)
  })
})
