import { describe, expect, it } from 'vitest'
import { getSharedMessages, type Language } from '@alfheim/shared'

const LANGUAGES: Language[] = ['en', 'de', 'pl']

function resolve(language: Language, key: string): string | undefined {
  let current: unknown = getSharedMessages(language)
  for (const part of key.split('.')) {
    current = (current as Record<string, unknown> | undefined)?.[part]
  }
  return typeof current === 'string' ? current : undefined
}

/** Keys that are assembled at runtime or passed as props and therefore invisible to the literal-key scan. */
const dynamicKeys = [
  ...['in', 'out', 'waste', 'reconciliation'].map((type) => `pantry.txType.${type}`),
  'pantry.errors.productInUse',
  'pantry.errors.locationInUse',
  'pantry.errors.categoryInUse',
  'pantry.errors.deleteProductFailed',
  'pantry.errors.deleteLocationFailed',
  'pantry.errors.deleteCategoryFailed',
  'pantry.errors.updateProductFailed',
  'pantry.errors.updateLocationFailed',
  'pantry.errors.updateCategoryFailed',
  'pantry.errors.transactionFailed',
  'pantry.errors.createCategoryFailed',
  'pantry.errors.barcodeLookupFailed',
  'pantry.errors.unreachable',
  'pantry.createProductFailed',
  'pantry.createLocationFailed',
]

describe('pantry dictionary', () => {
  it.each(LANGUAGES)('resolves every dynamically used key in %s', (language) => {
    for (const key of dynamicKeys) {
      expect(resolve(language, key), `${language}: ${key}`).toBeTruthy()
    }
  })

  it('translates German and Polish instead of copying English', () => {
    const sameAsEnglishAllowed = new Set(['pantry.txType.in'])
    const keys = [
      ...dynamicKeys,
      'pantry.mhd',
      'pantry.knapp',
      'pantry.noBatch',
      'pantry.stockOfMinimum',
      'pantry.export.sent',
      'pantry.export.failedAll',
      'pantry.export.failedSome',
      'pantry.export.retryFailed',
      'pantry.pager.newer',
      'pantry.pager.older',
      'pantry.pager.page',
      'pantry.edit.productTitle',
      'pantry.delete.productQuestion',
      'pantry.categoriesTitle',
      'pantry.analyticsTruncated',
      'pantry.errors.loadDashboard',
      'pantry.errors.loadProducts',
      'pantry.errors.loadLocations',
      'pantry.errors.loadInventory',
      'pantry.errors.loadLedger',
      'pantry.errors.loadAnalytics',
    ].filter((key) => !sameAsEnglishAllowed.has(key))

    for (const language of ['de', 'pl'] as const) {
      for (const key of keys) {
        expect(resolve(language, key), `${language}: ${key}`).not.toBe(resolve('en', key))
      }
    }
  })

  it('keeps the interpolation placeholders of every language in step', () => {
    const placeholders = (text: string | undefined) => (text?.match(/\{\w+\}/g) ?? []).sort().join(',')
    for (const key of dynamicKeys.concat(['pantry.export.sent', 'pantry.export.failedSome', 'pantry.pager.page', 'pantry.stockOfMinimum'])) {
      const expected = placeholders(resolve('en', key))
      expect(placeholders(resolve('de', key)), `de: ${key}`).toBe(expected)
      expect(placeholders(resolve('pl', key)), `pl: ${key}`).toBe(expected)
    }
  })
})
