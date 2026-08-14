import { http, HttpResponse } from 'msw'

export let mockLocations = [
  {
    id: 'loc-1',
    household_id: 'hh-1',
    name: 'Main Fridge',
    description: 'Kitchen primary refrigerator',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'loc-2',
    household_id: 'hh-1',
    name: 'Pantry Shelf A',
    description: 'Dry goods storage',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

export let mockCategories = [
  {
    id: 'cat-1',
    household_id: 'hh-1',
    name: 'Dairy',
    description: 'Milk, cheese, yogurt',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'cat-2',
    household_id: 'hh-1',
    name: 'Grains',
    description: 'Rice, pasta, bread',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

export let mockProducts = [
  {
    id: 'prod-1',
    household_id: 'hh-1',
    category_id: 'cat-1',
    name: 'Whole Milk',
    brand: 'Dairy Farm',
    barcode: '1234567890123',
    is_global: false,
    base_unit: 'liter',
    minimum_stock: 2,
    category: mockCategories[0],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'prod-2',
    household_id: 'hh-1',
    category_id: 'cat-2',
    name: 'Basmati Rice',
    brand: 'Grain Master',
    barcode: '9876543210987',
    is_global: false,
    base_unit: 'kg',
    minimum_stock: 5,
    category: mockCategories[1],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  },
]

export let mockInventoryStates = [
  {
    id: 'inv-1',
    household_id: 'hh-1',
    product_id: 'prod-1',
    location_id: 'loc-1',
    quantity: 1,
    earliest_expiration: '2025-12-31',
    product: mockProducts[0],
    location: mockLocations[0],
    last_updated: '2025-01-01T00:00:00Z',
  },
  {
    id: 'inv-2',
    household_id: 'hh-1',
    product_id: 'prod-2',
    location_id: 'loc-2',
    quantity: 10,
    earliest_expiration: '2026-06-30',
    product: mockProducts[1],
    location: mockLocations[1],
    last_updated: '2025-01-01T00:00:00Z',
  },
]

export let mockLowStockItems = [
  {
    product: mockProducts[0],
    current_stock: 1,
  },
]

export const mockExpirationSummary = {
  expired: 0,
  expiring_soon: 1,
  ok: 1,
}

export let mockTransactions = [
  {
    id: 'tx-1',
    household_id: 'hh-1',
    product_id: 'prod-1',
    location_id: 'loc-1',
    quantity: 2,
    transaction_type: 'out' as const,
    notes: 'Used for baking',
    expiration_date: '2025-12-31',
    created_at: '2025-01-02T10:00:00Z',
    product: mockProducts[0],
    location: mockLocations[0],
  },
]

export const handlers = [
  // Locations
  http.get('*/api/v1/locations', () => {
    return HttpResponse.json(mockLocations)
  }),

  http.post('*/api/v1/locations', async ({ request }) => {
    const body = (await request.json()) as any
    const newLoc = {
      id: `loc-${Date.now()}`,
      household_id: 'hh-1',
      name: body.name,
      description: body.description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockLocations.push(newLoc)
    return HttpResponse.json(newLoc, { status: 201 })
  }),

  // Categories
  http.get('*/api/v1/categories', () => {
    return HttpResponse.json(mockCategories)
  }),

  http.post('*/api/v1/categories', async ({ request }) => {
    const body = (await request.json()) as any
    const newCat = {
      id: `cat-${Date.now()}`,
      household_id: 'hh-1',
      name: body.name,
      description: body.description || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockCategories.push(newCat)
    return HttpResponse.json(newCat, { status: 201 })
  }),

  // Products
  http.get('*/api/v1/products', ({ request }) => {
    const url = new URL(request.url)
    const nameQuery = url.searchParams.get('name')
    if (nameQuery) {
      const filtered = mockProducts.filter((p) =>
        p.name.toLowerCase().includes(nameQuery.toLowerCase())
      )
      return HttpResponse.json(filtered)
    }
    return HttpResponse.json(mockProducts)
  }),

  http.post('*/api/v1/products', async ({ request }) => {
    const body = (await request.json()) as any
    const category = mockCategories.find((c) => c.id === body.category_id) || null
    const newProd = {
      id: `prod-${Date.now()}`,
      household_id: 'hh-1',
      category_id: body.category_id || null,
      name: body.name,
      brand: body.brand || null,
      barcode: body.barcode || null,
      is_global: false,
      base_unit: body.base_unit || 'piece',
      minimum_stock: body.minimum_stock ?? 0,
      category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockProducts.push(newProd)
    return HttpResponse.json(newProd, { status: 201 })
  }),

  // Inventory State
  http.get('*/api/v1/inventory/state', () => {
    return HttpResponse.json(mockInventoryStates)
  }),

  // Low Stock
  http.get('*/api/v1/inventory/low-stock', () => {
    return HttpResponse.json(mockLowStockItems)
  }),

  // Expiration Summary
  http.get('*/api/v1/inventory/expiration-summary', () => {
    return HttpResponse.json(mockExpirationSummary)
  }),

  // Transactions / Ledger
  http.get('*/api/v1/inventory/transactions', () => {
    return HttpResponse.json(mockTransactions)
  }),

  http.post('*/api/v1/inventory/transactions', async ({ request }) => {
    const body = (await request.json()) as any
    const product = mockProducts.find((p) => p.id === body.product_id) || mockProducts[0]
    const location = mockLocations.find((l) => l.id === body.location_id) || mockLocations[0]
    const newTx = {
      id: `tx-${Date.now()}`,
      household_id: 'hh-1',
      product_id: body.product_id,
      location_id: body.location_id,
      quantity: body.quantity,
      transaction_type: body.transaction_type,
      notes: body.notes || null,
      expiration_date: body.expiration_date || null,
      created_at: new Date().toISOString(),
      product,
      location,
    }
    mockTransactions.push(newTx)
    return HttpResponse.json(newTx, { status: 201 })
  }),
]
