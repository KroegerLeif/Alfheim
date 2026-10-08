import type { CategoryRead } from '@/features/categories/types'
import type { InventoryLedgerRead, InventoryStateReadWithRelations, LowStockItem } from '@/features/inventory/types'
import type { LocationRead } from '@/features/locations/types'
import type { ProductRead } from '@/features/products/types'

export const API = '/pantry/api/v1'

const NOW = '2026-06-15T12:00:00Z'

export function product(overrides: Partial<ProductRead> = {}): ProductRead {
  return {
    id: 'p1',
    name: 'Apples',
    brand: 'Farmer',
    barcode: null,
    image_url: null,
    base_unit: 'piece',
    minimum_stock: 5,
    category_id: null,
    is_global: false,
    home_id: 'hh-test',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

export function location(overrides: Partial<LocationRead> = {}): LocationRead {
  return {
    id: 'l1',
    name: 'Cellar',
    description: 'Cold shelf',
    is_system: false,
    owner_id: 'u1',
    home_id: 'hh-test',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

export function category(overrides: Partial<CategoryRead> = {}): CategoryRead {
  return {
    id: 'c1',
    name: 'Baking',
    description: null,
    is_global: false,
    owner_id: 'u1',
    home_id: 'hh-test',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
}

export function stateLine(overrides: Partial<InventoryStateReadWithRelations> = {}): InventoryStateReadWithRelations {
  return {
    id: 's1',
    product_id: 'p1',
    location_id: 'l1',
    quantity: 4,
    batch_code: null,
    expiration_date: null,
    created_at: NOW,
    updated_at: NOW,
    product: product(),
    location: location(),
    ...overrides,
  }
}

export function ledgerEntry(overrides: Partial<InventoryLedgerRead> = {}): InventoryLedgerRead {
  return {
    id: 'tx1',
    product_id: 'p1',
    location_id: 'l1',
    transaction_type: 'in',
    quantity: 5,
    quantity_input: 5,
    unit_input: 'piece',
    batch_code: null,
    expiration_date: null,
    notes: null,
    created_at: NOW,
    ...overrides,
  }
}

export function lowStock(overrides: Partial<ProductRead> = {}, currentStock = 1): LowStockItem {
  return { product: product({ minimum_stock: 5, ...overrides }), current_stock: currentStock }
}
