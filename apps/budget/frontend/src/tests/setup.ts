import "@testing-library/jest-dom";
import { useContext } from "react";
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

// Mock the shared library's useTranslation hook for tests.
//
// This still respects whichever LanguageProvider/language a test actually renders under (via the
// real LanguageContext), so components wrapped in <LanguageProvider defaultLanguage="de"> render
// German text in tests just like in production. On top of the real dictionary lookup, it keeps a
// small legacy map for a handful of pre-existing components that call t() with short, unprefixed
// keys (missing the "budget." prefix the real dictionary requires -- see issue #543). New code
// should use full dictionary paths (e.g. "budget.transactions.quickAdd").
vi.mock("@alfheim/shared", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@alfheim/shared");
  const messages = actual.messages as Record<string, Record<string, unknown>>;
  const LanguageContext = actual.LanguageContext as React.Context<{ language: string; setLanguage: (l: string) => void }>;

  function getNestedValue(obj: unknown, path: string): string | undefined {
    let current: unknown = obj;
    for (const key of path.split(".")) {
      if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return typeof current === "string" ? current : undefined;
  }

  const legacyTranslations: Record<string, string> = {
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

  function translate(language: string, key: string, params?: Record<string, string | number>): string {
    let value =
      legacyTranslations[key] ?? getNestedValue(messages[language], key) ?? getNestedValue(messages.de, key) ?? key;
    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        value = value.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
      });
    }
    return value;
  }

  return {
    ...actual,
    useTranslation: () => {
      const context = useContext(LanguageContext);
      const language = context?.language || "de";
      return {
        t: (key: string, params?: Record<string, string | number>) => translate(language, key, params),
        language,
        setLanguage: context?.setLanguage || (() => {}),
      };
    },
    useLanguage: () => {
      const context = useContext(LanguageContext);
      return {
        language: context?.language || "de",
        setLanguage: context?.setLanguage || (() => {}),
      };
    },
  };
});
