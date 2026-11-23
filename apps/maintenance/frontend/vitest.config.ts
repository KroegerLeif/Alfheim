import { defineAlfheimVitestConfig } from '../../../packages/shared/vitest.preset';

export default defineAlfheimVitestConfig({
  testTimeout: 30000,
  // Ratchet floor (#385): raise as coverage grows, never lower.
  thresholds: { statements: 94, branches: 86, functions: 91, lines: 95 },
});
