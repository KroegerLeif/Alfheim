// Shared type definitions matching backend models

export interface Household {
  id: number;
  name: string;
  address?: string | null;
}

export interface Manual {
  id: string;
  title: string;
  fileSize: string;
  url: string;
}

export interface MaintenanceStep {
  id: number;
  title: string;
  description?: string | null;
  recurrence: number; // interval in months
  supply_item?: string | null;
  supply_needed_date?: string | null;
  last_completed?: string | null;
  device_id: number;
}

export interface ServiceHistoryEvent {
  id: number;
  date: string;
  performer: string;
  notes?: string | null;
  device_id: number;
  completed_steps?: string[] | null;
}

/** Enriched variant returned by GET /api/v1/history — includes denormalised device fields. */
export interface ServiceHistoryEventDetail extends ServiceHistoryEvent {
  device_name: string;
  device_location: string;
}

export interface Device {
  id: number;
  name: string;
  model: string;
  serial: string;
  category: string;
  location: string;
  status: "active" | "maintenance" | "inactive";
  service_interval_months?: number | null;
  notes?: string | null;
  household_id: number;
  steps: MaintenanceStep[];
  history_events: ServiceHistoryEvent[];
}

export interface MaintenanceSubmitPayload {
  device_id: number;
  completed_step_ids: number[];
  step_notes?: string | null;
  performer: string;
  supply_items?: string[] | null;
}

/** Input payload for a single step during device creation. */
export interface CreateStepPayload {
  title: string;
  description?: string | null;
  recurrence: number;
  supply_item?: string | null;
}

/** Input payload for POST /api/v1/devices — creates a device with its initial steps. */
export interface CreateDevicePayload {
  name: string;
  model: string;
  serial: string;
  category: string;
  location: string;
  status: string;
  service_interval_months?: number | null;
  notes?: string | null;
  household_id: number;
  steps: CreateStepPayload[];
}

/** Input payload for POST /api/v1/tasks/{step_id}/state — lightweight step update. */
export interface TaskStateUpdatePayload {
  comment?: string | null;
  supply_needed_date?: string | null;
  supply_item?: string | null;
}
