import 'vitest'

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface Assertion<T = unknown> {
    toHaveNoViolations(): void
  }
}
