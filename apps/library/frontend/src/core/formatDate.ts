/** Format an ISO timestamp as a short date in the active UI language. */
export function formatDate(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(language);
}
