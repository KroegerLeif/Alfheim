import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('*/api/v1/households/me', () => {
    return HttpResponse.json([
      { id: 'hh-1', name: 'Main Household', slug: 'main', role: 'OWNER', is_default: true },
    ])
  }),
]
