import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock localStorage and sessionStorage globally for tests
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

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(global, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock next/navigation router hooks
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      prefetch: () => null,
      push: () => null,
      replace: () => null,
      back: () => null,
    }
  },
  usePathname() {
    return ''
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  useParams() {
    return {}
  },
}))

// Mock next-intl translations and localized routing
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  Link: ({ children, ...props }: any) => {
    const React = require('react')
    return React.createElement('a', props, children)
  },
  useRouter() {
    return {
      push: () => null,
      replace: () => null,
    }
  },
  usePathname() {
    return ''
  },
}))

// Mock @alfheim/shared's translation hook: return the last path segment of the key
// (e.g. "Chat.send" -> "send") so component tests can assert on stable, readable text
// without needing every real locale string in a hardcoded map.
vi.mock('@alfheim/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alfheim/shared')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key.split('.').pop() ?? key,
      language: 'en',
      setLanguage: () => {},
    }),
  }
})
