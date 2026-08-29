import "@testing-library/jest-dom";
import { vi } from "vitest";

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
  Link: ({ children, ...props }: any) => {
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
