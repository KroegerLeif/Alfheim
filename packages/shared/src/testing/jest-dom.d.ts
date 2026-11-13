/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type */
// @testing-library/jest-dom still augments vitest's `Assertion` with one type parameter; vitest 5 declares
// two (`R`, `T`), so its own augmentation no longer merges. Declare the matchers here until it catches up.
import type matchers from '@testing-library/jest-dom/matchers'

declare module 'vitest' {
  interface Assertion<R extends void | Promise<void> = void, T = unknown>
    extends matchers.TestingLibraryMatchers<any, R> {
    // Keeps the declaration's type parameters identical to vitest's.
    readonly __jestDomAssertionTarget?: T
  }
  interface AsymmetricMatchersContaining extends matchers.TestingLibraryMatchers<any, any> {}
}
