import type { Device, MaintenanceStep, ServiceHistoryEvent } from '@/shared/types'

let nextId = 1000

export function makeStep(overrides: Partial<MaintenanceStep> = {}): MaintenanceStep {
  nextId += 1
  return {
    id: nextId,
    title: 'Clean Filter',
    description: null,
    recurrence: 3,
    supply_item: null,
    supply_needed_date: null,
    last_completed: null,
    device_id: 1,
    ...overrides,
  }
}

export function makeHistoryEvent(overrides: Partial<ServiceHistoryEvent> = {}): ServiceHistoryEvent {
  nextId += 1
  return {
    id: nextId,
    date: '2025-06-01',
    performer: 'Test User',
    notes: null,
    device_id: 1,
    completed_steps: [],
    ...overrides,
  }
}

export function makeDevice(overrides: Partial<Device> = {}): Device {
  nextId += 1
  return {
    id: nextId,
    name: 'Washing Machine',
    model: 'WM-2000',
    serial: 'SN-12345',
    category: 'Appliances',
    location: 'Laundry Room',
    status: 'active',
    service_interval_months: 6,
    notes: null,
    household_id: 'hh-1',
    steps: [],
    history_events: [],
    ...overrides,
  }
}
