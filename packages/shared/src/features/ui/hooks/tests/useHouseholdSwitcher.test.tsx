import React from 'react'
import { renderHook, act, waitFor, render } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useHouseholdSwitcher } from '../useHouseholdSwitcher'
import { HouseholdProvider } from '../../../household/HouseholdProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <HouseholdProvider tokenRetries={0}>{children}</HouseholdProvider>
)

describe('useHouseholdSwitcher hook', () => {
  const mockHouseholds = [
    { id: 'hh-1', name: 'Main Residence', slug: 'main-residence', is_default: false },
    { id: 'hh-2', name: 'Summer House', slug: 'summer-house', is_default: true },
  ]

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem('alfheim_access_token', 'tkn')
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHouseholds,
    } as Response)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes the provider households and default selection', async () => {
    const { result } = renderHook(() => useHouseholdSwitcher(), { wrapper })
    await waitFor(() => expect(result.current.activeId).toBe('hh-2'))
    expect(result.current.households).toHaveLength(2)
    expect(result.current.selectedHousehold?.name).toBe('Summer House')
  })

  it('selecting a household persists it, dispatches the event and closes the dropdown', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const { result } = renderHook(() => useHouseholdSwitcher(), { wrapper })
    await waitFor(() => expect(result.current.activeId).toBe('hh-2'))

    act(() => result.current.setIsOpen(true))
    act(() => result.current.handleSelect('hh-1'))
    expect(result.current.activeId).toBe('hh-1')
    expect(result.current.isOpen).toBe(false)
    expect(localStorage.getItem('alfheim_active_household_id')).toBe('hh-1')
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'storage-household-changed' }))
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

    render(<TestComponent />, { wrapper })
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
