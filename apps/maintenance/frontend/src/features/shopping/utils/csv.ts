/** Characters that make spreadsheet software evaluate a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Quotes one CSV cell, doubling embedded quotes and defusing spreadsheet formulas. */
export function escapeCsvCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Builds the CSV text of the parts cart: one row per part, all marked as required. */
export function buildCartCsv(items: string[], labels: { partName: string; status: string; required: string }): string {
  const rows = [[labels.partName, labels.status], ...items.map((item) => [item, labels.required])];
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}
