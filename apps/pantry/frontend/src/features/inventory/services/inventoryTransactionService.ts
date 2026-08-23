import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pantryClient } from "@/core/api";
import {
  LowStockItem,
  InventoryTransactionCreate,
  InventoryLedgerRead
} from "../types";
import { inventoryKeys, useActiveHouseholdId } from "./inventoryService";

/**
 * 4. Helper action to push low-stock items to active household Shopping App
 * Fetches current low-stock levels and forwards them via POST /api/v1/shopping/items.
 */
export async function pushLowStockToShoppingApp(): Promise<{ success: boolean; pushedCount: number }> {
  const lowStockItems = await pantryClient
    .get("api/v1/inventory/low-stock")
    .json<LowStockItem[]>();

  if (lowStockItems.length === 0) {
    return { success: true, pushedCount: 0 };
  }

  let token = "";
  if (typeof window !== "undefined") {
    token = sessionStorage.getItem("token_pantry-frontend") || "";
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let pushedCount = 0;
  for (const item of lowStockItems) {
    const requiredQty = Math.max(1, item.product.minimum_stock - item.current_stock);
    const payload = {
      name: item.product.name,
      quantity: requiredQty,
      unit: item.product.base_unit || "piece",
      product_id: item.product.id,
      barcode: item.product.barcode || null,
    };

    try {
      const targetUrl = process.env.NEXT_PUBLIC_SHOPPING_API_URL
        ? `${process.env.NEXT_PUBLIC_SHOPPING_API_URL}/items`
        : "http://api.alfheim.loegien.localhost/shopping/api/v1/items";

      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        pushedCount++;
      }
    } catch (err) {
      console.error("Error pushing item to shopping app:", err);
    }
  }

  return { success: pushedCount > 0, pushedCount };
}

export async function exportLowStockShoppingList(): Promise<LowStockItem[]> {
  return pantryClient
    .get("api/v1/inventory/low-stock")
    .json<LowStockItem[]>();
}

/**
 * 5. POST /api/v1/inventory/transactions
 * TanStack Mutation to record an IN, OUT, WASTE, or RECONCILIATION transaction.
 * Re-fetches all relevant inventory lists on success.
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation<InventoryLedgerRead, any, InventoryTransactionCreate>({
    mutationFn: (payload) =>
      pantryClient
        .post("api/v1/inventory/transactions", { json: payload })
        .json<InventoryLedgerRead>(),
    onSuccess: () => {
      // Invalidate all inventory queries to refresh states across the app
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

/**
 * 6. GET /api/v1/inventory/transactions
 * Retrieves transaction audit ledger history logs.
 */
export function useLedgerHistory(productId?: string, locationId?: string, limit = 100, offset = 0) {
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<InventoryLedgerRead[]>({
    queryKey: inventoryKeys.ledgerFiltered(activeHouseholdId, productId, locationId, limit, offset),
    queryFn: () =>
      pantryClient
        .get("api/v1/inventory/transactions", {
          searchParams: {
            ...(productId && { product_id: productId }),
            ...(locationId && { location_id: locationId }),
            limit,
            offset,
          },
        })
        .json<InventoryLedgerRead[]>(),
  });
}
