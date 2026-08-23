import { useQuery } from "@tanstack/react-query";
import { pantryClient } from "@/core/api";
import {
  InventoryStateReadWithRelations,
  LowStockItem,
  ExpirationSummary,
} from "../types";

import { useState, useEffect } from "react";

export * from "./inventoryTransactionService";

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
