import { describe, it, expect } from 'vitest'
import { getCategoryKeyForItem } from '../category'

describe('getCategoryKeyForItem', () => {
  it.each([
    ['Äpfel (apfel)', 'produce'],
    ['Vollmilch', 'dairy'],
    ['Brötchen', 'bakery'],
    ['Spüli', 'household'],
    ['Hähnchenbrust', 'meat'],
    ['Mineralwasser', 'beverages'],
    ['Basmati Reis', 'pantry'],
    ['Something else entirely', 'other'],
  ])('puts %s into %s', (name, key) => {
    expect(getCategoryKeyForItem(name)).toBe(key)
  })

  it('puts items linked to a Pantry product into the Pantry stock group', () => {
    expect(getCategoryKeyForItem('Vollmilch', 'product-1')).toBe('pantryStock')
  })
})
