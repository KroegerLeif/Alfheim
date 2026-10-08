import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { interpolate } from '../interpolate'
import { useTranslation } from '../useTranslation'

describe('interpolate', () => {
  it('returns the template unchanged without params', () => {
    expect(interpolate('Hello {name}')).toBe('Hello {name}')
  })

  it('replaces every occurrence of a placeholder, including numbers', () => {
    expect(interpolate('{n} of {n} sets, {total} kg', { n: 3, total: 0 })).toBe('3 of 3 sets, 0 kg')
  })

  it('inserts values literally even when they contain replacement patterns', () => {
    expect(interpolate('Delete {name}?', { name: 'Cost $& more' })).toBe('Delete Cost $& more?')
    expect(interpolate('Delete {name}?', { name: "$1 $$ $` $'" })).toBe("Delete $1 $$ $` $'?")
  })

  it('does not interpolate placeholders that appear inside a value', () => {
    expect(interpolate('{a} and {b}', { a: '{b}', b: 'B' })).toBe('{b} and B')
  })

  it('treats parameter names with regex characters literally', () => {
    expect(interpolate('Total: {a.b} / {a+}', { 'a.b': 1, 'a+': 2 })).toBe('Total: 1 / 2')
    expect(interpolate('{axb}', { 'a.b': 1 })).toBe('{axb}')
  })

  it('leaves placeholders without a matching parameter in place', () => {
    expect(interpolate('{known} {unknown} {toString}', { known: 'x' })).toBe('x {unknown} {toString}')
  })
})

describe('useTranslation interpolation', () => {
  it('renders dollar patterns in parameter values literally', () => {
    const { result } = renderHook(() => useTranslation())
    expect(result.current.t('missing.key {name}', { name: 'Cost $& more $1' })).toBe(
      'missing.key Cost $& more $1',
    )
  })
})
