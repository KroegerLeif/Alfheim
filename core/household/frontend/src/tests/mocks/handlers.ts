import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('*api/v1/apps', () => {
    return HttpResponse.json([
      { id: 'pantry', name: 'Pantry', status: 'online', tier: 1 },
      { id: 'shopping', name: 'Shopping', status: 'online', tier: 1 },
    ])
  }),

  http.get('*api/v1/households', () => {
    return HttpResponse.json([
      { id: 'hh-1', name: 'Main Household', is_default: true },
    ])
  }),
]
