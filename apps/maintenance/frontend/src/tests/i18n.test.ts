import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { getSharedMessages, type Language } from '@alfheim/shared'

const SRC_ROOT = path.resolve(__dirname, '..')
const LANGUAGES: Language[] = ['en', 'de', 'pl']

type Json = { [key: string]: Json | string }

function flatten(obj: Json, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[full] = value
    else flatten(value, full, out)
  }
  return out
}

const dictionaries = Object.fromEntries(
  LANGUAGES.map((lang) => [lang, flatten(getSharedMessages(lang) as Json)])
) as Record<Language, Record<string, string>>

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'tests' || entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, acc)
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name)) acc.push(full)
  }
  return acc
}

const files = sourceFiles(SRC_ROOT).map((file) => ({
  file: path.relative(SRC_ROOT, file),
  source: fs.readFileSync(file, 'utf8'),
}))

interface KeyUse {
  file: string
  key: string
}

/** Literal keys passed to `t("...")` in files that bind `t` to `namespace` via next-intl or to the root via the shared hook. */
function collectKeys(): KeyUse[] {
  const uses: KeyUse[] = []
  for (const { file, source } of files) {
    const nextIntlBindings = [...source.matchAll(/const\s+(\w+)\s*=\s*useTranslations\(\s*["'](\w+)["']\s*\)/g)]
    for (const [, fn, namespace] of nextIntlBindings) {
      for (const call of source.matchAll(new RegExp(`(?<![\\w.])${fn}\\(\\s*["']([^"'$]+)["']`, 'g'))) {
        uses.push({ file, key: `${namespace}.${call[1]}` })
      }
    }
    const sharedBindings = [...source.matchAll(/const\s*\{\s*t(?:\s*:\s*(\w+))?\s*\}\s*=\s*useTranslation\(\)/g)]
    for (const [, alias] of sharedBindings) {
      const fn = alias ?? 't'
      for (const call of source.matchAll(new RegExp(`(?<![\\w.])${fn}\\(\\s*["']([^"'$]+)["']`, 'g'))) {
        uses.push({ file, key: call[1] })
      }
    }
  }
  return uses
}

describe('translation keys of the maintenance frontend', () => {
  const uses = collectKeys()

  it('finds the keys used by the components', () => {
    expect(uses.length).toBeGreaterThan(100)
    expect(uses.map((u) => u.key)).toContain('maintenance.header.notifications')
    expect(uses.map((u) => u.key)).toContain('common.error_boundary.title')
  })

  it.each(LANGUAGES)('resolves every literal key in %s', (lang) => {
    const unresolved = uses.filter((u) => !(u.key in dictionaries[lang])).map((u) => `${u.file}: ${u.key}`)
    expect(unresolved).toEqual([])
  })

  it('has translated (not copied) German and Polish for the strings this app owns', () => {
    const appKeys = [...new Set(uses.filter((u) => u.key.startsWith('maintenance.')).map((u) => u.key))]
    // Words and format placeholders that are legitimately identical to the English text in that language.
    const identicalToEnglish: Record<'de' | 'pl', Set<string>> = {
      de: new Set([
        'maintenance.deviceInventory.fields.model',
        'maintenance.wizard.name',
        'maintenance.wizard.status',
        'maintenance.wizardMode.progress',
        'maintenance.maintenanceWork.detailsBtn',
        'maintenance.shopping.csvExport',
        'maintenance.shopping.csvStatus',
        'maintenance.categories.hvac',
      ]),
      pl: new Set([
        'maintenance.deviceInventory.fields.model',
        'maintenance.wizard.status',
        'maintenance.wizardMode.progress',
        'maintenance.maintenanceWork.startBtn',
        'maintenance.shopping.csvStatus',
        'maintenance.categories.hvac',
      ]),
    }
    const copied = (['de', 'pl'] as const).flatMap((lang) =>
      appKeys
        .filter((key) => dictionaries[lang][key] === dictionaries.en[key] && !identicalToEnglish[lang].has(key))
        .map((key) => `${lang}: ${key}`)
    )
    expect(copied).toEqual([])
  })
})

describe('hardcoded user-facing strings', () => {
  const TEXT_ATTRIBUTES = /\b(placeholder|aria-label|title|alt)=("[^"{}]*[A-Za-z]{2,}[^"{}]*"|'[^'{}]*[A-Za-z]{2,}[^'{}]*')/g
  // JSX text between a closing `>` and the next `<`, free of code-like characters.
  const JSX_TEXT = />([^<>{}=;()|&'"`]*[A-Za-z]{2,}[^<>{}=;()|&'"`]*)</g

  it('renders no literal text or text attributes in components', () => {
    const offenders: string[] = []
    for (const { file, source } of files) {
      if (!file.endsWith('.tsx')) continue
      const code = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const match of code.matchAll(TEXT_ATTRIBUTES)) offenders.push(`${file}: ${match[0]}`)
      for (const match of code.matchAll(JSX_TEXT)) {
        // Generic type arguments such as `useState<string>(...)` are not JSX text.
        if (/^\s*(string|number|boolean|null|undefined)\b/.test(match[1])) continue
        offenders.push(`${file}: >${match[1].trim().replace(/\s+/g, ' ')}<`)
      }
    }
    expect(offenders).toEqual([])
  })
})
