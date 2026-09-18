import 'vitest'
import { AxeResults } from 'vitest-axe'

declare module 'vitest' {
  export interface Assertion<T = any> {
    toHaveNoViolations(): void
  }
}
