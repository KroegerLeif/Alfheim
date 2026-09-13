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

// Mock the shared library's useTranslation hook for tests
vi.mock("@alfheim/shared", async () => {
  const actual = await vi.importActual("@alfheim/shared");
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        // Return a human-readable version for common keys
        const translations: Record<string, string> = {
          "transactions.quickAdd": "Quick-Add Transaction",
          "transactions.description": "Description",
          "transactions.descriptionPlaceholder": "e.g. Supermarket Grocery",
          "transactions.amount": "Amount",
          "transactions.type": "Type",
          "transactions.expense": "Expense",
          "transactions.income": "Income",
          "transactions.transfer": "Transfer",
          "transactions.accountOptional": "Account (Optional)",
          "transactions.targetPotOptional": "Target Pot (Optional)",
          "transactions.planOptional": "Plan (Optional)",
          "transactions.none": "-- None --",
          "transactions.logging": "Logging...",
          "common.cancel": "Cancel",
        };
        return translations[key] || key;
      },
      language: "en",
      setLanguage: () => {},
    }),
    useLanguage: () => ({
      language: "en",
      setLanguage: () => {},
    }),
  };
});
