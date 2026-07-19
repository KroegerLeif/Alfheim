import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats an ISO date string into a user-friendly format (e.g., "Jul 19, 2026").
 */
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid Date";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Calculates the number of days from today until a target date.
 * Returns negative values for past/overdue dates.
 */
export function daysUntil(dateString: string | undefined): number {
  if (!dateString) return 0;
  const targetDate = new Date(dateString);
  if (isNaN(targetDate.getTime())) return 0;
  
  const today = new Date();
  // Strip hours to get exact calendar day counts
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Calculates a next due date by adding a given interval of months to a start date.
 * Returns date in YYYY-MM-DD format.
 */
export function nextDueFromStep(lastPerformed: string | undefined, intervalMonths: number): string {
  const start = lastPerformed ? new Date(lastPerformed) : new Date();
  if (isNaN(start.getTime())) return "";
  
  start.setMonth(start.getMonth() + intervalMonths);
  return start.toISOString().split("T")[0];
}
