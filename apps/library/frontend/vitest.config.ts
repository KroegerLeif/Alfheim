import { defineAlfheimVitestConfig } from '../../../packages/shared/vitest.preset';

export default defineAlfheimVitestConfig({ coverageInclude: ['src/**/*.{ts,tsx}'] });
