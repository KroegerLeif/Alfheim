import react from '@vitejs/plugin-react';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

/** Options of {@link defineAlfheimVitestConfig}. */
export interface AlfheimVitestOptions {
  /** Project root. Defaults to the directory Vitest runs in (the frontend package). */
  root?: string;
  /** Per-test timeout in milliseconds. Defaults to 15000. */
  testTimeout?: number;
  /** Files coverage is measured on. Defaults to every file Vitest loads. */
  coverageInclude?: string[];
}

/**
 * The Vitest config every Next.js frontend shares: jsdom, globals, `src/tests/setup.ts`, the
 * tsconfig path aliases and the common coverage exclusions. Coverage thresholds stay with each
 * app's quality gate (#385), not here.
 *
 * @example
 * export default defineAlfheimVitestConfig();
 */
export function defineAlfheimVitestConfig(options: AlfheimVitestOptions = {}): ViteUserConfig {
  const { root, testTimeout = 15000, coverageInclude } = options;
  return defineConfig({
    root,
    plugins: [react()],
    resolve: {
      tsconfigPaths: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/tests/setup.ts',
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
      testTimeout,
      // pnpm runs several packages at once; vitest 5 timed out under that load with the default of cores - 1.
      maxWorkers: 2,
      coverage: {
        provider: 'v8',
        ...(coverageInclude ? { include: coverageInclude } : {}),
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
      },
    },
  });
}
