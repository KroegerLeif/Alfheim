import { http, HttpResponse } from 'msw'

const VALID_UUID_LIST_1 = '11111111-1111-4111-a111-111111111111'
const VALID_UUID_LIST_2 = '22222222-2222-4222-a222-222222222222'
const VALID_UUID_LIST_NEW = '66666666-6666-4666-a666-666666666666'
const VALID_UUID_HOME = '33333333-3333-4333-a333-333333333333'
const VALID_UUID_OWNER = '44444444-4444-4444-a444-444444444444'
const VALID_UUID_ITEM_1 = '55555555-5555-4555-a555-555555555555'

export const HISTORY_ENTRY_ID = '99999999-9999-4999-a999-999999999999'
export const PANTRY_PRODUCT_ID = '77777777-7777-4777-a777-777777777777'

/** Builds a server-shaped shopping item for handlers that echo or create items. */
export function makeItem(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    id: VALID_UUID_ITEM_1,
    list_id: VALID_UUID_LIST_1,
    name: 'Milk',
    brand: null,
    barcode: null,
    quantity: 1,
    unit: 'stk',
    is_completed: false,
    is_auto_generated: false,
    is_synced: false,
    product_id: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export const handlers = [
  http.get('*/api/v1/shopping-lists', () => {
    return HttpResponse.json([
      {
        id: VALID_UUID_LIST_1,
        home_id: VALID_UUID_HOME,
        owner_id: VALID_UUID_OWNER,
        name: 'Weekly Groceries',
        is_default: true,
        is_personal: false,
        position: 1,
        items: [
          {
            id: VALID_UUID_ITEM_1,
            list_id: VALID_UUID_LIST_1,
            name: 'Milk',
            quantity: 2,
            unit: 'L',
            is_completed: false,
            is_auto_generated: false,
            is_synced: false,
            product_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: VALID_UUID_LIST_2,
        home_id: VALID_UUID_HOME,
        owner_id: VALID_UUID_OWNER,
        name: 'Party Supplies',
        is_default: false,
        is_personal: false,
        position: 2,
        items: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  http.get('*/api/v1/shopping-lists/:id', ({ params }) => {
    const now = new Date().toISOString()
    return HttpResponse.json({
      id: params.id,
      home_id: VALID_UUID_HOME,
      owner_id: VALID_UUID_OWNER,
      name: 'Weekly Groceries',
      is_default: true,
      is_personal: false,
      position: 1,
      created_at: now,
      updated_at: now,
      items: [
        makeItem({ id: VALID_UUID_ITEM_1, list_id: params.id, name: 'Milk', quantity: 2, unit: 'l' }),
        makeItem({
          id: '56565656-5656-4565-a565-565656565656',
          list_id: params.id,
          name: 'Bread',
          is_completed: true,
        }),
      ],
    })
  }),

  http.post('*/api/v1/shopping-lists', async ({ request }) => {
    const body = (await request.json()) as any
    return HttpResponse.json({
      id: VALID_UUID_LIST_NEW,
      home_id: VALID_UUID_HOME,
      owner_id: VALID_UUID_OWNER,
      name: body.name || 'New List',
      is_default: false,
      is_personal: false,
      position: 3,
      items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.delete('*/api/v1/shopping-lists/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch('*/api/v1/shopping-lists/reorder', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('*/api/v1/households/me', () => {
    return HttpResponse.json([
      { id: VALID_UUID_HOME, name: 'Main Household', is_default: true },
    ])
  }),

  http.post('*/api/v1/products', async ({ request }) => {
    const body = (await request.json()) as any
    return HttpResponse.json({
      id: PANTRY_PRODUCT_ID,
      name: body.name || 'Product',
      base_unit: body.base_unit || 'piece',
      minimum_stock: body.minimum_stock || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.post('*/api/v1/shopping-lists/:id/sync-to-pantry', () => {
    return HttpResponse.json({
      status: 'success',
      synced_count: 1,
      unrecognized_count: 0,
      unrecognized_items: [],
    })
  }),

  http.delete('*/api/v1/shopping-lists/:id/items/:itemId', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('*/api/v1/shopping-lists/:id/items', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(makeItem({ ...body, id: '12121212-1212-4121-a121-121212121212', list_id: params.id }), {
      status: 201,
    })
  }),

  http.patch('*/api/v1/shopping-lists/:id/items/:itemId', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(makeItem({ ...body, id: params.itemId, list_id: params.id }))
  }),

  http.get('*/api/v1/shopping-history', () => {
    const now = new Date().toISOString()
    return HttpResponse.json([
      {
        id: HISTORY_ENTRY_ID,
        home_id: VALID_UUID_HOME,
        name: 'Oat Milk',
        brand: '',
        barcode: null,
        unit: 'l',
        purchase_count: 3,
        icon_tag: 'icon.grocery.milk',
        last_purchased_at: now,
        created_at: now,
        updated_at: now,
      },
    ])
  }),

  http.delete('*/api/v1/shopping-history/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]
