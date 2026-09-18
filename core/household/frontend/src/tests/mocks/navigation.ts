import { vi } from 'vitest'

/** Shared next/navigation mock state, reset after every test (see setup.ts). */
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  forward: vi.fn(),
}

export const mockNavigation = {
  pathname: '/',
  search: '',
}

export function resetNavigationMock() {
  Object.values(mockRouter).forEach((fn) => fn.mockReset())
  mockNavigation.pathname = '/'
  mockNavigation.search = ''
}
