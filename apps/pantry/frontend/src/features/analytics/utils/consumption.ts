import { InventoryLedgerRead } from "@/features/inventory/types";

/** Number of calendar months the consumption chart covers, current month included. */
export const CONSUMPTION_MONTHS = 6;

export interface MonthBucket {
  /** Sortable `YYYY-MM` key in the user's local time zone. */
  key: string;
  /** Short month name in the active UI language. */
  label: string;
}

export interface MonthlyConsumption {
  label: string;
  value: number;
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** First instant (local time) of the oldest month the chart shows. */
export function consumptionWindowStart(now: Date, months = CONSUMPTION_MONTHS): Date {
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
}

/** The last `months` calendar months, oldest first, labelled for `language`. */
export function lastMonths(now: Date, language: string, months = CONSUMPTION_MONTHS): MonthBucket[] {
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return {
      key: monthKey(date),
      label: date.toLocaleString(language, { month: "short" }).toUpperCase(),
    };
  });
}

/**
 * Sums consumption (OUT and WASTE) per local calendar month. The ledger stores consumption as negative
 * quantities, so magnitudes are summed; every other transaction type and rows outside the window are
 * ignored.
 */
export function bucketMonthlyConsumption(
  rows: InventoryLedgerRead[],
  now: Date,
  language: string,
  months = CONSUMPTION_MONTHS
): MonthlyConsumption[] {
  const buckets = lastMonths(now, language, months);
  const totals = new Map(buckets.map((bucket) => [bucket.key, 0]));
  for (const row of rows) {
    if (row.transaction_type !== "out" && row.transaction_type !== "waste") continue;
    const key = monthKey(new Date(row.created_at));
    const current = totals.get(key);
    if (current !== undefined) totals.set(key, current + Math.abs(row.quantity));
  }
  return buckets.map((bucket) => ({
    label: bucket.label,
    value: parseFloat((totals.get(bucket.key) ?? 0).toFixed(1)),
  }));
}
