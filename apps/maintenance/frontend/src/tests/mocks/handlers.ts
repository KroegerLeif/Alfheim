import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('*/households', () => {
    return HttpResponse.json([
      { id: 1, name: 'Main Home' },
    ])
  }),

  http.get('*/devices', () => {
    return HttpResponse.json([
      {
        id: 1,
        name: 'Washing Machine',
        model: 'WM-2000',
        serial: 'SN-12345',
        category: 'Appliance',
        location: 'Laundry Room',
        status: 'active',
        service_interval_months: 6,
        household_id: 1,
        steps: [],
        history_events: [],
      },
      {
        id: 2,
        name: 'Dishwasher',
        model: 'DW-500',
        serial: 'SN-67890',
        category: 'Appliance',
        location: 'Kitchen',
        status: 'active',
        service_interval_months: 3,
        household_id: 1,
        steps: [],
        history_events: [],
      },
    ])
  }),

  http.post('*/devices', () => {
    return HttpResponse.json({
      id: 3,
      name: 'Fridge',
      model: 'FR-500',
      serial: 'SN-111',
      category: 'Appliance',
      location: 'Kitchen',
      status: 'active',
      service_interval_months: 12,
      household_id: 1,
      steps: [],
      history_events: [],
    })
  }),

  http.post('*/maintenance/submit', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('*/maintenance/scheduled', () => {
    return HttpResponse.json([
      {
        id: 'step-1',
        title: 'Clean Filter',
        description: 'Remove lint and flush filter',
        recurrence: 3,
        supply_item: 'Filter Cleaner',
        supply_needed_date: '2025-02-01',
        last_completed: '2024-11-01',
        device_id: 1,
      },
    ])
  }),

  http.get('*/maintenance/history', () => {
    return HttpResponse.json([
      {
        id: 'hist-1',
        date: '2024-11-01',
        performer: 'User 1',
        notes: 'Filter replaced',
        completed_steps: ['Clean Filter'],
        device_id: 1,
      },
    ])
  }),
]
