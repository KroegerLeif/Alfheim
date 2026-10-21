import type { PropsWithChildren } from 'react'
import "@testing-library/jest-dom";
import { vi } from "vitest";
import { configure } from '@testing-library/react'

// findBy*/waitFor poll for 5s instead of 1s. The default 1s is shorter than legitimate latency: a cold first
// render, or ky retrying a failed GET with backoff (~0.9s), so tests failed once the machine was busy
// (CI, parallel workspaces). The limit only bounds failures; passing tests are not slowed down.
configure({ asyncUtilTimeout: 5000 })

const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(global, "sessionStorage", {
  value: localStorageMock,
  writable: true,
});

vi.mock("next/navigation", () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: () => null,
      replace: () => null,
      back: () => null,
    };
  },
  usePathname() {
    return "";
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  useParams() {
    return {};
  },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  Link: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => {
    const React = require("react");
    return React.createElement("a", props, children);
  },
  useRouter() {
    return {
      push: () => null,
      replace: () => null,
    };
  },
  usePathname() {
    return "";
  },
}));

// Wrap the shared library's real useTranslation hook for tests.
//
// Translations come from the real dictionaries and the real LanguageContext, so components rendered
// under <LanguageProvider defaultLanguage="de"> show German text exactly as in production. Any key
// that does not resolve in the active dictionary throws, so a missing or unprefixed key (see #579)
// fails the test instead of silently rendering the raw key.
vi.mock("@alfheim/shared", async () => {
  const actual = await vi.importActual<typeof import("@alfheim/shared")>("@alfheim/shared");
  return {
    ...actual,
    useTranslation: () => {
      const result = actual.useTranslation();
      return {
        ...result,
        t: (key: string, params?: Record<string, string | number>) => {
          const value = result.t(key, params);
          if (value === key) {
            throw new Error(`Unresolved i18n key "${key}" (language: ${result.language})`);
          }
          return value;
        },
      };
    },
  };
});
