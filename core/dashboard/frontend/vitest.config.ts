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
        'src/app/**',
        'src/proxy.ts',
        'src/i18n.ts',
        'src/navigation.ts',
        'src/tests/**',
      ],
      // Thresholds target 90% once remaining backlog tests are completed (see backlog-coverage-gates.md)
    },
  },
});
