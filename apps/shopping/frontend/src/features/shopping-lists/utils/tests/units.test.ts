import { describe, it, expect } from 'vitest'
import { getSharedMessages } from '@alfheim/shared'
import { UNIT_CODES, DEFAULT_UNIT, unitLabel } from '../units'

type Units = Record<string, string>
const dictionary = (lang: 'en' | 'de' | 'pl') => (getSharedMessages(lang) as { Units: Units }).Units
const translator = (lang: 'en' | 'de' | 'pl') => (key: string) => dictionary(lang)[key]

describe('unitLabel', () => {
  it('localizes every unit the picker offers in en, de and pl', () => {
    for (const lang of ['en', 'de', 'pl'] as const) {
      for (const code of UNIT_CODES) {
        const label = unitLabel(code, translator(lang))
        expect(label, `${lang}:${code}`).toBeTruthy()
      }
    }
  })

  it('keeps the stored code stable and only changes the label', () => {
    expect(DEFAULT_UNIT).toBe('stk')
    expect(unitLabel('stk', translator('de'))).toBe('Stk')
    expect(unitLabel('stk', translator('en'))).toBe('pcs')
    expect(unitLabel('stk', translator('pl'))).toBe('szt.')
    expect(unitLabel('fl.', translator('en'))).toBe('btl.')
    expect(unitLabel('dose', translator('pl'))).toBe('puszka')
  })

  it('is case-insensitive because the backend stores lower-case codes', () => {
    expect(unitLabel('Stk', translator('en'))).toBe('pcs')
    expect(unitLabel('L', translator('en'))).toBe('L')
  })

  it('labels the units that come in from Pantry and shows unknown units as stored', () => {
    expect(unitLabel('piece', translator('de'))).toBe('Stk')
    expect(unitLabel('bottle', translator('de'))).toBe('Fl.')
    expect(unitLabel('sack', translator('de'))).toBe('sack')
  })

  it('does not use English abbreviations for German or Polish labels', () => {
    const en = dictionary('en')
    for (const lang of ['de', 'pl'] as const) {
      const other = dictionary(lang)
      for (const key of ['piece', 'bottle', 'pack', 'bunch', 'can', 'packet', 'bag', 'box']) {
        expect(other[key], `${lang}:${key}`).not.toBe(en[key])
      }
    }
  })
})
