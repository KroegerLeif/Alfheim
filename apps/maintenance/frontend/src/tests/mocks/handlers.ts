import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('*api/v1/devices', () => {
    return HttpResponse.json([
      {
        id: 'dev-1',
        name: 'Washing Machine',
        model: 'WM-2000',
        serial: 'SN-12345',
        category: 'Appliance',
        location: 'Laundry Room',
        status: 'active',
        service_interval_months: 6,
        household_id: 'hh-1',
      },
      {
        id: 'dev-2',
        name: 'Dishwasher',
        model: 'DW-500',
        serial: 'SN-67890',
        category: 'Appliance',
        location: 'Kitchen',
        status: 'active',
        service_interval_months: 3,
        household_id: 'hh-1',
      },
    ])
  }),

  http.get('*api/v1/maintenance/scheduled', () => {
    return HttpResponse.json([
      {
        id: 'step-1',
        title: 'Clean Filter',
        description: 'Remove lint and flush filter',
        recurrence: 3,
        supply_item: 'Filter Cleaner',
        supply_needed_date: '2025-02-01',
        last_completed: '2024-11-01',
        device_id: 'dev-1',
      },
    ])
  }),

  http.get('*api/v1/maintenance/history', () => {
    return HttpResponse.json([
      {
        id: 'hist-1',
        date: '2024-11-01',
        performer: 'User 1',
        notes: 'Filter replaced',
        completed_steps: ['Clean Filter'],
        device_id: 'dev-1',
      },
    ])
  }),
]
