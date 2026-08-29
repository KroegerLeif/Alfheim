import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useMediaQuery, useIsDesktop, MD_BREAKPOINT_QUERY } from '../useMediaQuery'

type ChangeHandler = (event: MediaQueryListEvent) => void

/** Installs a controllable matchMedia stub and returns a setter to flip the match state. */
function stubMatchMedia(initialMatches: boolean) {
  const handlers = new Set<ChangeHandler>()

  const matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: initialMatches,
    media: query,
    addEventListener: (_: string, handler: ChangeHandler) => handlers.add(handler),
    removeEventListener: (_: string, handler: ChangeHandler) => handlers.delete(handler),
  }))

  Object.defineProperty(window, 'matchMedia', { value: matchMedia, writable: true, configurable: true })

  return {
    matchMedia,
    emit: (matches: boolean) =>
      handlers.forEach((handler) => handler({ matches } as MediaQueryListEvent)),
    handlerCount: () => handlers.size,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('settles to the current match state after mount', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('reports false when the query does not match', () => {
    stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('updates when the media query changes', () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => media.emit(true))
    expect(result.current).toBe(true)
  })

  it('unsubscribes on unmount', () => {
    const media = stubMatchMedia(true)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(media.handlerCount()).toBe(1)

    unmount()
    expect(media.handlerCount()).toBe(0)
  })

  it('returns false when matchMedia is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', { value: undefined, writable: true, configurable: true })
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })
})

describe('useIsDesktop', () => {
  it('queries the md breakpoint', () => {
    const media = stubMatchMedia(true)
    const { result } = renderHook(() => useIsDesktop())
    expect(media.matchMedia).toHaveBeenCalledWith(MD_BREAKPOINT_QUERY)
    expect(result.current).toBe(true)
  })
})
