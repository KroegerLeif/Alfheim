import { renderHook, waitFor } from '@testing-library/react'
import { useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation } from '../locationService'
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
      expect(pantryClient.get).toHaveBeenCalledWith('api/v1/locations', { searchParams: { limit: 100, offset: 0 } })
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

  describe('useUpdateLocation', () => {
    it('patches the location and refreshes locations and inventory', async () => {
      const updated = { id: 'l1', name: 'Cellar', description: null }
      vi.mocked(pantryClient.patch).mockReturnValue({ json: vi.fn().mockResolvedValue(updated) } as any)
      const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

      const { result } = renderHook(() => useUpdateLocation(), { wrapper: createQueryWrapper() })
      result.current.mutate({ id: 'l1', payload: { name: 'Cellar', description: null } })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(pantryClient.patch).toHaveBeenCalledWith('api/v1/locations/l1', { json: { name: 'Cellar', description: null } })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['locations'] })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['inventory'] })
      invalidateSpy.mockRestore()
    })
  })

  describe('useDeleteLocation', () => {
    it('deletes the location and refreshes the list', async () => {
      vi.mocked(pantryClient.delete).mockResolvedValue({} as any)
      const invalidateSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries')

      const { result } = renderHook(() => useDeleteLocation(), { wrapper: createQueryWrapper() })
      result.current.mutate('l1')

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(pantryClient.delete).toHaveBeenCalledWith('api/v1/locations/l1')
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['locations'] })
      invalidateSpy.mockRestore()
    })

    it('surfaces a rejected delete to the caller', async () => {
      vi.mocked(pantryClient.delete).mockRejectedValue(new Error('conflict'))

      const { result } = renderHook(() => useDeleteLocation(), { wrapper: createQueryWrapper() })
      result.current.mutate('l1')

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })
})
