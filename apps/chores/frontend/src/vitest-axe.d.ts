import 'vitest'

declare module 'vitest' {
  export interface Assertion {
    toHaveNoViolations(): void
  }
}
