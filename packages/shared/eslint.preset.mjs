import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * The ESLint flat config every Next.js frontend and `@alfheim/shared` share: Next.js core web
 * vitals, the TypeScript rules and the Alfheim exceptions below. Pass app-specific config objects
 * as `extra`; they are appended, so they can override any rule here.
 *
 * @param {import('eslint').Linter.Config[]} [extra] Additional flat config objects for one package.
 * @returns {import('eslint').Linter.Config[]} The flat config to export from `eslint.config.mjs`.
 *
 * @example
 * import { defineAlfheimEslintConfig } from '@alfheim/shared/eslint-preset';
 *
 * export default defineAlfheimEslintConfig();
 */
export function defineAlfheimEslintConfig(extra = []) {
  return defineConfig([
    ...nextVitals,
    ...nextTs,
    // The a11y sweep promotes these to errors rule by rule once each is clean (#385).
    {
      rules: {
        'jsx-a11y/label-has-associated-control': 'warn',
        'jsx-a11y/no-static-element-interactions': 'warn',
        'jsx-a11y/click-events-have-key-events': 'warn',
        'jsx-a11y/alt-text': 'warn',
      },
    },
    // Test doubles legitimately use require() inside vi.mock factories and anonymous wrapper components.
    {
      files: ['src/tests/**', '**/*.test.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        'react/display-name': 'off',
      },
    },
    // The runtime-config script must run before any app code (OIDC issuer, client id and API URLs
    // are injected by the container at start, never baked into the build), so it is deliberately
    // synchronous.
    {
      files: ['src/app/**/layout.tsx'],
      rules: {
        '@next/next/no-sync-scripts': 'off',
      },
    },
    // The default ignores of eslint-config-next, restated because a flat config replaces them.
    globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', 'next-env.d.ts']),
    ...extra,
  ]);
}
