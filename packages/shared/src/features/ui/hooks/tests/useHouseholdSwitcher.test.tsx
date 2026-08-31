import React from 'react'
import { renderHook, act, waitFor, render } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useHouseholdSwitcher, KeycloakWindow } from '../useHouseholdSwitcher'

describe('useHouseholdSwitcher hook', () => {
  const mockHouseholds = [
    { id: 'hh-1', name: 'Main Residence', slug: 'main-residence', is_default: false },
    { id: 'hh-2', name: 'Summer House', slug: 'summer-house', is_default: true },
  ]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    delete (window as unknown as KeycloakWindow).__keycloak_instance__
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes empty state when local storage cache is invalid JSON or empty', () => {
    localStorage.setItem('alfheim_cached_households', 'invalid-json')
    const { result } = renderHook(() => useHouseholdSwitcher())
    expect(result.current.households).toEqual([])
    expect(result.current.activeId).toBeNull()
  })

  it('updates activeId on storage and storage-household-changed window events', async () => {
    localStorage.setItem('alfheim_cached_households', JSON.stringify(mockHouseholds))
    localStorage.setItem('alfheim_active_household_id', 'hh-1')

    const { result } = renderHook(() => useHouseholdSwitcher())
    expect(result.current.activeId).toBe('hh-1')

    act(() => {
      localStorage.setItem('alfheim_active_household_id', 'hh-2')
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'alfheim_active_household_id', newValue: 'hh-2' })
      )
    })
    expect(result.current.activeId).toBe('hh-2')

    act(() => {
      localStorage.setItem('alfheim_active_household_id', 'hh-1')
      window.dispatchEvent(new Event('storage-household-changed'))
    })
    expect(result.current.activeId).toBe('hh-1')
  })

  it('fetches households using Keycloak instance updateToken and sets default household', async () => {
    const updateTokenMock = vi.fn().mockResolvedValue(true)
    ;(window as unknown as KeycloakWindow).__keycloak_instance__ = {
      token: 'keycloak-token-123',
      updateToken: updateTokenMock,
    }

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockHouseholds,
    } as Response)

    const { result } = renderHook(() => useHouseholdSwitcher())

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/households/me', {
        headers: { Authorization: 'Bearer keycloak-token-123' },
      })
      expect(result.current.activeId).toBe('hh-2')
    })
  })

  it('handles 401 response and retries with refreshed Keycloak token', async () => {
    const updateTokenMock = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
    ;(window as unknown as KeycloakWindow).__keycloak_instance__ = {
      token: 'refreshed-token-456',
      updateToken: updateTokenMock,
    }

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ status: 401, ok: false } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHouseholds,
      } as Response)

    renderHook(() => useHouseholdSwitcher())

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  })

  it('handles click outside to close dropdown when element is mounted', () => {
    function TestComponent() {
      const { isOpen, setIsOpen, dropdownRef } = useHouseholdSwitcher()
      return (
        <div>
          <div ref={dropdownRef} data-testid="dropdown">
            <button type="button" onClick={() => setIsOpen(true)}>
              Open
            </button>
            {isOpen && <div data-testid="content">Menu</div>}
          </div>
          <button type="button" data-testid="outside">
            Outside
          </button>
        </div>
      )
    }

    render(<TestComponent />)
    act(() => {
      document.querySelector('button')?.click()
    })
    expect(document.querySelector('[data-testid="content"]')).toBeInTheDocument()

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(document.querySelector('[data-testid="content"]')).not.toBeInTheDocument()
  })
})
