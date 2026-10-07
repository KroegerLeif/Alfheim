import { vi } from 'vitest'

/** Shared router double: tests assert navigation on these spies. Reset between tests in setup.ts. */
export const routerMock = {
  prefetch: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
}
