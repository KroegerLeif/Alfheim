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
