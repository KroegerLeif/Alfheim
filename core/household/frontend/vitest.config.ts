import { defineAlfheimVitestConfig } from '../../../packages/shared/vitest.preset';

export default defineAlfheimVitestConfig({
  // Ratchet floor (#385): raise as coverage grows, never lower.
  thresholds: { statements: 59, branches: 56, functions: 43, lines: 61 },
});
