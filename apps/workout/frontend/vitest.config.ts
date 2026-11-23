import { defineAlfheimVitestConfig } from '../../../packages/shared/vitest.preset';

export default defineAlfheimVitestConfig({
  // Ratchet floor (#385): raise as coverage grows, never lower.
  thresholds: { statements: 88, branches: 83, functions: 82, lines: 90 },
});
