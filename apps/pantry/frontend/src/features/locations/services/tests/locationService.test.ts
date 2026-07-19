import { renderHook, waitFor } from '@testing-library/react'
import { useLocations, useCreateLocation } from '../locationService'
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

describe('Location Service Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useLocations', () => {
    it('fetches physical locations successfully', async () => {
      const mockLocations = [
        { id: 'l1', name: 'Pantry Room A', description: 'Main pantry', is_system: false, owner_id: 'u1', home_id: 'h1', created_at: 'now', updated_at: 'now' },
        { id: 'l2', name: 'Fridge', description: 'Refrigerated section', is_system: true, owner_id: null, home_id: 'h1', created_at: 'now', updated_at: 'now' },
      ]
      const mockJson = vi.fn().mockResolvedValue(mockLocations)
      vi.mocked(pantryClient.get).mockReturnValue({
        json: mockJson,
      } as any)

      const { result } = renderHook(() => useLocations(), {
        wrapper: createQueryWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockLocations)
      expect(pantryClient.get).toHaveBeenCalledWith('api/v1/locations')
    })
  })

  describe('useCreateLocation', () => {
    it('creates a new physical location and invalidates cache', async () => {
      const newLoc = { name: 'Basement shelf', description: 'Cold storage' }
      const mockLocRead = { id: 'l3', ...newLoc, is_system: false, owner_id: 'u1', home_id: 'h1', created_at: 'now', updated_at: 'now' }
      const mockJson = vi.fn().mockResolvedValue(mockLocRead)
      vi.mocked(pantryClient.post).mockReturnValue({
        json: mockJson,
      } as any)

      const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

      const { result } = renderHook(() => useCreateLocation(), {
        wrapper: createQueryWrapper(),
      })

      result.current.mutate(newLoc)

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual(mockLocRead)
      expect(pantryClient.post).toHaveBeenCalledWith('api/v1/locations', { json: newLoc })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['locations'] })

      invalidateSpy.mockRestore()
    })
  })
})
