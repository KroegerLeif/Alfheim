import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/tests/setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/e2e/**',
        '**/*.d.ts',
        '**/types.ts',
        '**/types/**',
        '**/index.ts',
        'src/assets/**',
        'src/features/i18n/locales/**',
        'src/tests/**',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
