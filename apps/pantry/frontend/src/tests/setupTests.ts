import '@testing-library/jest-dom'
import * as matchers from 'vitest-axe/matchers'
import { expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { server } from '../mocks/server'

// Extend vitest expect with vitest-axe matchers
expect.extend(matchers)

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})

// Clean up server after all tests
afterAll(() => server.close())

// Mock localStorage and sessionStorage globally for tests
const localStorageMock = (function () {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
Object.defineProperty(global, 'sessionStorage', {
  value: localStorageMock,
  writable: true,
})

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

// Mock @alfheim/shared translation hook for pantry tests
vi.mock('@alfheim/shared', async () => {
  const actual = await vi.importActual<any>('@alfheim/shared')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const keyMap: Record<string, string> = {
          'pantry.locationsTitle': 'title',
          'pantry.locationsSub': 'subtitle',
          'pantry.createBtn': 'createBtn',
          'pantry.createBtnClose': 'createBtnClose',
          'pantry.createLocationTitle': 'createTitle',
          'pantry.locationName': 'name',
          'pantry.locationDesc': 'description',
          'pantry.submitLocation': 'submit',
          'pantry.creatingLocation': 'creating',
          'pantry.locationSuccess': 'success',
          'pantry.noLocations': 'noLocations',
          'pantry.systemLocation': 'system',
          'pantry.ok': '✓ OK',
          'pantry.mhd': 'MHD',
          'pantry.knapp': 'knapp',
          'pantry.productsTitle': 'title',
          'pantry.productsSub': 'subtitle',
          'pantry.searchBlueprints': 'searchPlaceholder',
          'pantry.noProducts': 'noProducts',
          'pantry.global': 'global',
          'pantry.custom': 'custom',
          'pantry.brandLabel': 'brandLabel',
          'pantry.barcodeLabel': 'barcodeLabel',
          'pantry.minStockLabel': 'minStockLabel',
          'pantry.createProductTitle': 'createTitle',
          'pantry.productName': 'name',
          'pantry.brand': 'brand',
          'pantry.barcode': 'barcode',
          'pantry.category': 'category',
          'pantry.baseUnit': 'baseUnit',
          'pantry.submitProduct': 'submit',
          'pantry.creatingProduct': 'creating',
          'pantry.analyticsTitle': 'title',
          'pantry.analyticsSub': 'subtitle',
          'pantry.consumptionTitle': 'consumptionTitle',
          'pantry.categoryTitle': 'categoryTitle',
          'pantry.noData': 'noData',
          'pantry.noStockData': 'noStockData',
          'pantry.consumedLabel': 'consumedLabel',
          'pantry.stockLabel': 'stockLabel',
          'pantry.items': 'items',
          'pantry.noCategory': 'noCategory',
          'pantry.exportList': 'exportList',
          'pantry.filterCategory': 'All Categories',
          'pantry.filterLocation': 'All Locations',
          'pantry.stockInventory': 'Stock Inventory',
          'pantry.stockInventorySub': 'Manage and inspect pantry stock',
          'pantry.product': 'Product',
          'pantry.location': 'Location',
          'pantry.quantity': 'Quantity',
          'pantry.expiration': 'Expiration',
          'pantry.actions': 'Actions',
          'pantry.loadingRegisters': 'Loading Registers...',
          'pantry.noItems': 'No Items Found',
          'pantry.refresh': 'Refresh',
          'nav.dashboard': 'dashboard',
          'nav.inventory': 'inventory',
        }
        if (key in keyMap) return keyMap[key]
        const parts = key.split('.')
        return parts[parts.length - 1]
      },
      language: 'en',
      setLanguage: () => {},
    }),
  }
})
