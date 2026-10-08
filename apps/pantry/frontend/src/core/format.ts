/** Matches a calendar date without time, as the Pantry API sends expiration dates. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Format an API date for display in the active UI language. Date-only values are built from their
 * parts, so a date never shifts by a day when the browser sits west of UTC.
 */
export function formatDate(value: string, language: string): string {
  const parts = DATE_ONLY.exec(value);
  const date = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(language);
}

/** Format an API timestamp (date and time) for display in the active UI language. */
export function formatDateTime(value: string, language: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
}
