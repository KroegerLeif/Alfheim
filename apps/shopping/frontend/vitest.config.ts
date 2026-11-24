import { defineAlfheimVitestConfig } from '../../../packages/shared/vitest.preset';

export default defineAlfheimVitestConfig({
  // Ratchet floor (#385): raise as coverage grows, never lower.
  thresholds: { statements: 82, branches: 72, functions: 76, lines: 83 },
});
