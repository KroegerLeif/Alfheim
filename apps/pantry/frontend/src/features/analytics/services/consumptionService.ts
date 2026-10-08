import { useQuery } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { pantryClient } from "@/core/api";
import { InventoryLedgerRead } from "@/features/inventory/types";
import { inventoryKeys } from "@/features/inventory/services/inventoryService";
import { consumptionWindowStart } from "../utils/consumption";

/** The ledger endpoint returns at most this many rows per request. */
const PAGE_SIZE = 100;
/** Safety bound (5000 rows) so a runaway ledger can never turn one chart into an endless request loop. */
const MAX_PAGES = 50;

export interface ConsumptionLedger {
  rows: InventoryLedgerRead[];
  /** True when the safety bound was hit and older rows of the window are missing. */
  truncated: boolean;
}

/**
 * Reads every OUT and WASTE ledger row since `windowStart` by paging through the server-side filtered
 * history, so the chart covers the whole period instead of only the latest page.
 */
export async function fetchConsumptionLedger(windowStart: Date): Promise<ConsumptionLedger> {
  const rows: InventoryLedgerRead[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await pantryClient
      .get("api/v1/inventory/transactions", {
        searchParams: [
          ["transaction_type", "out"],
          ["transaction_type", "waste"],
          ["date_from", windowStart.toISOString()],
          ["limit", String(PAGE_SIZE)],
          ["offset", String(page * PAGE_SIZE)],
        ],
      })
      .json<InventoryLedgerRead[]>();
    const items = batch ?? [];
    rows.push(...items);
    if (items.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/** Consumption ledger rows of the chart window (current month and the five before it). */
export function useConsumptionLedger() {
  const { householdId, status } = useActiveHousehold();
  const windowStart = consumptionWindowStart(new Date());

  return useQuery<ConsumptionLedger>({
    // The window start changes once a month, which keeps the cache fresh across month boundaries.
    queryKey: [...inventoryKeys.ledger(householdId), "consumption", windowStart.getTime()],
    queryFn: () => fetchConsumptionLedger(windowStart),
    enabled: status === "ready",
  });
}
