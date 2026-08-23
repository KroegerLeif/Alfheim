import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pantryClient } from "@/core/api";
import {
  InventoryTransactionCreate,
  InventoryLedgerRead
} from "../types";
import { useActiveHouseholdId, inventoryKeys } from "./inventoryService";

/**
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
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

/**
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
