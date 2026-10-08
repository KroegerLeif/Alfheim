import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** A step due within this many days (inclusive) counts as "due soon". Mirrors the backend summary. */
export const DUE_SOON_THRESHOLD_DAYS = 14;

/** The "Upcoming" scheduled-task filter shows steps due within this many days (and everything overdue). */
export const UPCOMING_WINDOW_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DueStatus = "overdue" | "due_soon" | "ok" | "unscheduled";

/**
 * Parses a backend date into a calendar date at local midnight.
 *
 * The backend stores due dates as date-only `YYYY-MM-DD` strings. `new Date("YYYY-MM-DD")` would read
 * those as UTC midnight, which is the previous calendar day in every timezone behind UTC, so date-only
 * values are built from their components instead. Full timestamps are converted to the local calendar day.
 * Returns `null` for empty or unparseable input.
 */
export function parseCalendarDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();

  const dateOnly = DATE_ONLY_PATTERN.exec(trimmed);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const monthIndex = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, monthIndex, day);
    // Reject overflowing dates such as 2025-02-31, which Date would silently roll into March.
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) return null;
    return date;
  }

  const timestamp = new Date(trimmed);
  if (isNaN(timestamp.getTime())) return null;
  return new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
}

/**
 * Formats a backend date for display in `locale` (for example "Jul 19, 2026").
 * Returns `null` when the value is empty or not a date so callers can show a localized placeholder.
 */
export function formatDate(value: string | null | undefined, locale: string): string | null {
  const date = parseCalendarDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

/**
 * Calendar days from today until `value` in the user's local timezone (negative = overdue).
 * Returns `null` when the step has no usable due date, matching the backend where such steps are not overdue.
 */
export function daysUntil(value: string | null | undefined, now: Date = new Date()): number | null {
  const target = parseCalendarDate(value);
  if (!target) return null;
  // Compare calendar days through UTC so a daylight-saving change cannot make a day 23 or 25 hours long.
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetDay - today) / MS_PER_DAY);
}

/** Classifies a day count from {@link daysUntil}. `null` means the step has no due date yet. */
export function dueStatusFromDays(days: number | null): DueStatus {
  if (days === null) return "unscheduled";
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_THRESHOLD_DAYS) return "due_soon";
  return "ok";
}

/** Convenience wrapper: due status of a backend due date. */
export function getDueStatus(value: string | null | undefined, now: Date = new Date()): DueStatus {
  return dueStatusFromDays(daysUntil(value, now));
}
