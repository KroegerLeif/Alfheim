import { defineAlfheimVitestConfig } from '../../../packages/shared/vitest.preset';

export default defineAlfheimVitestConfig({
  coverageInclude: ['src/**/*.{ts,tsx}'],
  // Ratchet floor (#385): raise as coverage grows, never lower.
  thresholds: { statements: 92, branches: 85, functions: 84, lines: 93 },
});
