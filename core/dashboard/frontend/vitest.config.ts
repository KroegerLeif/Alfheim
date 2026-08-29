import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

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
      thresholds: {
        lines: 25,
        statements: 25,
        branches: 20,
        functions: 25,
      },
    },
  },
})
