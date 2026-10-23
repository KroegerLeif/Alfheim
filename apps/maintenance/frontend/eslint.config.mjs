import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
