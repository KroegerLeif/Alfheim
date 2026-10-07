import { describe, it, expect } from 'vitest'
import { buildCartCsv, escapeCsvCell } from '../utils/csv'

const LABELS = { partName: 'Part Name', status: 'Status', required: 'Required' }

describe('escapeCsvCell', () => {
  it('quotes the cell and doubles embedded quotes', () => {
    expect(escapeCsvCell('Filter 3" x 5"')).toBe('"Filter 3"" x 5"""')
  })

  it('prefixes spreadsheet formulas so they are read as text', () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(escapeCsvCell('+1')).toBe('"\'+1"')
    expect(escapeCsvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"')
    expect(escapeCsvCell('-5 mm washer')).toBe('"\'-5 mm washer"')
  })

  it('keeps commas and line breaks inside the quotes', () => {
    expect(escapeCsvCell('Seal, large\nblue')).toBe('"Seal, large\nblue"')
  })
})

describe('buildCartCsv', () => {
  it('writes a header row and one required row per part', () => {
    expect(buildCartCsv(['HEPA Filter', 'Gasket'], LABELS)).toBe(
      ['"Part Name","Status"', '"HEPA Filter","Required"', '"Gasket","Required"'].join('\n')
    )
  })

  it('uses the translated labels', () => {
    expect(buildCartCsv(['Filter'], { partName: 'Ersatzteil', status: 'Status', required: 'Benötigt' })).toBe(
      ['"Ersatzteil","Status"', '"Filter","Benötigt"'].join('\n')
    )
  })
})
