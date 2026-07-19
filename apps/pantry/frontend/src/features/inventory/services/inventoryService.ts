import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pantryClient } from "@/lib/api";
import { 
  InventoryStateReadWithRelations, 
  LowStockItem, 
  ExpirationSummary,
  InventoryTransactionCreate,
  InventoryLedgerRead
} from "../types";

export const inventoryKeys = {
  all: ["inventory"] as const,
  states: () => [...inventoryKeys.all, "state"] as const,
  stateFiltered: (productId?: string, locationId?: string) => 
    [...inventoryKeys.states(), { productId, locationId }] as const,
  lowStock: () => [...inventoryKeys.all, "low-stock"] as const,
  expirationSummary: () => [...inventoryKeys.all, "expiration-summary"] as const,
  ledger: () => [...inventoryKeys.all, "ledger"] as const,
  ledgerFiltered: (productId?: string, locationId?: string, limit?: number, offset?: number) => 
    [...inventoryKeys.ledger(), { productId, locationId, limit, offset }] as const,
};

/**
 * 1. GET /api/v1/inventory/state
 * Retrieves the real-time cached inventory levels, optionally filtered by product and location.
 */
export function useInventoryState(productId?: string, locationId?: string) {
  return useQuery<InventoryStateReadWithRelations[]>({
    queryKey: inventoryKeys.stateFiltered(productId, locationId),
    queryFn: () => 
      pantryClient
        .get("api/v1/inventory/state", {
          searchParams: {
            ...(productId && { product_id: productId }),
            ...(locationId && { location_id: locationId }),
          },
        })
        .json<InventoryStateReadWithRelations[]>(),
  });
}

/**
 * 2. GET /api/v1/inventory/low-stock
 * Retrieves inventory products that have fallen below their minimum stock thresholds.
 */
export function useLowStockItems() {
  return useQuery<LowStockItem[]>({
    queryKey: inventoryKeys.lowStock(),
    queryFn: () => 
      pantryClient
        .get("api/v1/inventory/low-stock")
        .json<LowStockItem[]>(),
  });
}

/**
 * 3. GET /api/v1/inventory/expiration-summary
 * Retrieves summary of inventory items categorized by their expiration status.
 */
export function useExpirationSummary() {
  return useQuery<ExpirationSummary>({
    queryKey: inventoryKeys.expirationSummary(),
    queryFn: () => 
      pantryClient
        .get("api/v1/inventory/expiration-summary")
        .json<ExpirationSummary>(),
  });
}

/**
 * 4. Helper action to trigger low-stock exporting
 * Fetches the active low stock levels and returns the payload to be forwarded to external systems.
 */
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
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}

/**
 * 6. GET /api/v1/inventory/transactions
 * Retrieves transaction audit ledger history logs.
 */
export function useLedgerHistory(productId?: string, locationId?: string, limit = 100, offset = 0) {
  return useQuery<InventoryLedgerRead[]>({
    queryKey: inventoryKeys.ledgerFiltered(productId, locationId, limit, offset),
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
