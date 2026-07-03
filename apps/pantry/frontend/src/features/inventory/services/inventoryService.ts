import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { 
  InventoryStateReadWithRelations, 
  LowStockItem, 
  ExpirationSummary 
} from "../types";

export const inventoryKeys = {
  all: ["inventory"] as const,
  states: () => [...inventoryKeys.all, "state"] as const,
  stateFiltered: (productId?: string, locationId?: string) => 
    [...inventoryKeys.states(), { productId, locationId }] as const,
  lowStock: () => [...inventoryKeys.all, "low-stock"] as const,
  expirationSummary: () => [...inventoryKeys.all, "expiration-summary"] as const,
};

/**
 * 1. GET /api/v1/inventory/state
 * Retrieves the real-time cached inventory levels, optionally filtered by product and location.
 */
export function useInventoryState(productId?: string, locationId?: string) {
  return useQuery<InventoryStateReadWithRelations[]>({
    queryKey: inventoryKeys.stateFiltered(productId, locationId),
    queryFn: () => 
      apiClient
        .get<InventoryStateReadWithRelations[]>("/api/v1/inventory/state", {
          params: { product_id: productId, location_id: locationId },
        })
        .then((res) => res.data),
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
      apiClient
        .get<LowStockItem[]>("/api/v1/inventory/low-stock")
        .then((res) => res.data),
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
      apiClient
        .get<ExpirationSummary>("/api/v1/inventory/expiration-summary")
        .then((res) => res.data),
  });
}

/**
 * 4. Helper action to trigger low-stock exporting
 * Fetches the active low stock levels and returns the payload to be forwarded to external systems.
 */
export async function exportLowStockShoppingList(): Promise<LowStockItem[]> {
  const response = await apiClient.get<LowStockItem[]>("/api/v1/inventory/low-stock");
  // Forward payload to external REST webhook or external handler here in the future
  return response.data;
}
