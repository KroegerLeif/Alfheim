import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './src/tests/setupTests.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
})
