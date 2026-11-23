/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type */
// Module augmentation has to merge with vitest's own interfaces: the members come from
// CustomMatchers, so the declarations stay empty and keep vitest's `any` default.
import 'vitest'
import { AxeResults } from 'vitest-axe'

interface CustomMatchers<R = unknown> {
  toHaveNoViolations(): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
