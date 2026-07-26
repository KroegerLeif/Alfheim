import '@testing-library/jest-dom'
import { vi } from 'vitest'

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
    // Return standard anchor representation
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

// Mock @loeger-os/shared translation hook for pantry tests
vi.mock('@loeger-os/shared', async () => {
  const actual = await vi.importActual<any>('@loeger-os/shared')
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

