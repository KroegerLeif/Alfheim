import { http, HttpResponse } from 'msw'

const VALID_UUID_LIST_1 = '11111111-1111-4111-a111-111111111111'
const VALID_UUID_LIST_2 = '22222222-2222-4222-a222-222222222222'
const VALID_UUID_LIST_NEW = '66666666-6666-4666-a666-666666666666'
const VALID_UUID_HOME = '33333333-3333-4333-a333-333333333333'
const VALID_UUID_OWNER = '44444444-4444-4444-a444-444444444444'
const VALID_UUID_ITEM_1 = '55555555-5555-4555-a555-555555555555'

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
      id: '77777777-7777-4777-a777-777777777777',
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
]
