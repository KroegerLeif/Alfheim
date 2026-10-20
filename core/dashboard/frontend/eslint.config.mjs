import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/alt-text": "warn",
    },
  },
  // React Compiler rules shipped with eslint-config-next 16.4 as errors; the existing effects predate
  // them, so they only warn until each one is reworked.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Test doubles legitimately use require() inside vi.mock factories and anonymous wrapper components.
  {
    files: ["src/tests/**", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // The runtime-config script must run before any app code (OIDC issuer, client id and API URLs are
  // injected by the container at start, never baked into the build), so it is deliberately synchronous.
  {
    files: ["src/app/**/layout.tsx"],
    rules: {
      "@next/next/no-sync-scripts": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
