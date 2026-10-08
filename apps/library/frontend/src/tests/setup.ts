import "@testing-library/jest-dom";
import { vi } from "vitest";

// Node ships an experimental global localStorage that shadows the jsdom one and has no getItem
// without --localstorage-file, so provide a plain in-memory store for the language and household
// providers.
function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

Object.defineProperty(globalThis, "localStorage", { value: createStorageMock(), writable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: createStorageMock(), writable: true });

// Wrap the shared library's real useTranslation hook for tests.
//
// Translations come from the real dictionaries and the real LanguageContext, so components rendered
// under <LanguageProvider defaultLanguage="de"> show German text exactly as in production (and German
// is also what a component rendered without any provider gets, as in the app). Any key that does not
// resolve in the active dictionary throws, so a missing or unprefixed key fails the test instead of
// silently rendering a raw key or the last key segment.
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
