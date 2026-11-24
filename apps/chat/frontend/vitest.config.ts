import { defineAlfheimVitestConfig } from '../../../packages/shared/vitest.preset';

export default defineAlfheimVitestConfig({
  // Ratchet floor (#385): raise as coverage grows, never lower.
  thresholds: { statements: 85, branches: 80, functions: 77, lines: 86 },
});
