import { useQuery } from "@tanstack/react-query";
import { pantryClient } from "@/core/api";
import {
  InventoryStateReadWithRelations,
  LowStockItem,
  ExpirationSummary,
} from "../types";
import { useState, useEffect } from "react";

export {
  useCreateTransaction,
  useLedgerHistory,
} from "./inventoryLedgerService";

export function useActiveHouseholdId() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(localStorage.getItem("alfheim_active_household_id"));

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "alfheim_active_household_id") {
        setActiveId(e.newValue);
      }
    };

    const handleLocalChange = () => {
      setActiveId(localStorage.getItem("alfheim_active_household_id"));
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("storage-household-changed", handleLocalChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("storage-household-changed", handleLocalChange);
    };
  }, []);

  return activeId;
}

export const inventoryKeys = {
  all: (householdId: string | null) => ["inventory", { householdId }] as const,
  states: (householdId: string | null) => [...inventoryKeys.all(householdId), "state"] as const,
  stateFiltered: (householdId: string | null, productId?: string, locationId?: string) =>
    [...inventoryKeys.states(householdId), { productId, locationId }] as const,
  lowStock: (householdId: string | null) => [...inventoryKeys.all(householdId), "low-stock"] as const,
  expirationSummary: (householdId: string | null) => [...inventoryKeys.all(householdId), "expiration-summary"] as const,
  ledger: (householdId: string | null) => [...inventoryKeys.all(householdId), "ledger"] as const,
  ledgerFiltered: (householdId: string | null, productId?: string, locationId?: string, limit?: number, offset?: number) =>
    [...inventoryKeys.ledger(householdId), { productId, locationId, limit, offset }] as const,
};

/**
 * 1. GET /api/v1/inventory/state
 * Retrieves the real-time cached inventory levels, optionally filtered by product and location.
 */
export function useInventoryState(productId?: string, locationId?: string) {
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<InventoryStateReadWithRelations[]>({
    queryKey: inventoryKeys.stateFiltered(activeHouseholdId, productId, locationId),
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
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<LowStockItem[]>({
    queryKey: inventoryKeys.lowStock(activeHouseholdId),
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
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<ExpirationSummary>({
    queryKey: inventoryKeys.expirationSummary(activeHouseholdId),
    queryFn: () =>
      pantryClient
        .get("api/v1/inventory/expiration-summary")
        .json<ExpirationSummary>(),
  });
}

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
