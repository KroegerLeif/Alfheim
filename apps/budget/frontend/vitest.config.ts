import { defineAlfheimVitestConfig } from '../../../packages/shared/vitest.preset';

export default defineAlfheimVitestConfig({
  // Ratchet floor (#385): raise as coverage grows, never lower.
  thresholds: { statements: 78, branches: 78, functions: 62, lines: 80 },
});
