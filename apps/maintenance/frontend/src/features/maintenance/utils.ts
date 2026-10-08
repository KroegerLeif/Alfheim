import { Device } from "@/shared/types";
import { daysUntil, dueStatusFromDays, getDueStatus } from "@/core/utils";

/** Dashboard filter: every device, or only the devices in one maintenance state. */
export type MetricFilter = "all" | "overdue" | "due_soon" | "ok";

/** Maintenance state of a device or step. Steps without a due date count as "ok", like the backend summary. */
export type MaintenanceState = Exclude<MetricFilter, "all">;

export interface StepCounts {
  total: number;
  overdue: number;
  dueSoon: number;
  ok: number;
}

function toMaintenanceState(dueDate: string | null | undefined, now: Date): MaintenanceState {
  const status = getDueStatus(dueDate, now);
  return status === "unscheduled" ? "ok" : status;
}

/** Counts the steps of all devices per maintenance state. */
export function countSteps(devices: Device[], now: Date = new Date()): StepCounts {
  const counts: StepCounts = { total: 0, overdue: 0, dueSoon: 0, ok: 0 };
  for (const device of devices) {
    for (const step of device.steps ?? []) {
      counts.total++;
      const state = toMaintenanceState(step.supply_needed_date, now);
      if (state === "overdue") counts.overdue++;
      else if (state === "due_soon") counts.dueSoon++;
      else counts.ok++;
    }
  }
  return counts;
}

/** The worst state among a device's steps: overdue beats due soon beats ok. */
export function getDeviceMaintenanceState(device: Device, now: Date = new Date()): MaintenanceState {
  const states = (device.steps ?? []).map((step) => toMaintenanceState(step.supply_needed_date, now));
  if (states.includes("overdue")) return "overdue";
  if (states.includes("due_soon")) return "due_soon";
  return "ok";
}

/** The earliest due date among a device's steps, or null when none of its steps is scheduled. */
export function getNextServiceDate(device: Device): string | null {
  const dates = (device.steps ?? []).map((step) => step.supply_needed_date).filter((date): date is string => !!date);
  if (dates.length === 0) return null;
  return dates.reduce((earliest, date) => (date < earliest ? date : earliest), dates[0]);
}

export interface DueAlert {
  /** Stable key: one alert per step. */
  id: string;
  state: "overdue" | "due_soon";
  stepTitle: string;
  deviceName: string;
  /** Days overdue (positive) for "overdue" alerts, days until due (0 or more) for "due_soon" alerts. */
  days: number;
}

/** Overdue and due-soon steps across all devices, most urgent first. Unscheduled steps raise no alert. */
export function collectDueAlerts(devices: Device[], now: Date = new Date()): DueAlert[] {
  const found: { alert: DueAlert; remaining: number }[] = [];
  for (const device of devices) {
    for (const step of device.steps ?? []) {
      const remaining = daysUntil(step.supply_needed_date, now);
      const state = dueStatusFromDays(remaining);
      if (remaining === null || (state !== "overdue" && state !== "due_soon")) continue;
      found.push({
        remaining,
        alert: {
          id: `${device.id}-${step.id}`,
          state,
          stepTitle: step.title,
          deviceName: device.name,
          days: Math.abs(remaining),
        },
      });
    }
  }
  return found.sort((a, b) => a.remaining - b.remaining).map(({ alert }) => alert);
}
