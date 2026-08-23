import { useMutation, useQueryClient } from "@tanstack/react-query";
import { shoppingClient, pantryClient } from "@/lib/api";
import { z } from "zod";
import {
  ShoppingItemSchema,
  SyncToPantryResponseSchema,
  ProductReadSchema,
} from "../schemas";
import { ShoppingItem, SyncToPantryResponse } from "../types";
import { shoppingKeys } from "./shoppingListService";

export interface PantryProductCreatePayload {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  base_unit: string;
  minimum_stock: number;
  category_id?: string | null;
  householdId?: string;
}

/**
 * Hook to import low-stock items from Pantry inventory alerts.
 */
export function useImportLowStock(listId: string) {
  const queryClient = useQueryClient();
  return useMutation<ShoppingItem[], Error, void>({
    mutationFn: () =>
      shoppingClient
        .post(`api/v1/shopping-lists/${listId}/auto-import-low-stock`)
        .json()
        .then((data) => z.array(ShoppingItemSchema).parse(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
    },
  });
}

/**
 * Hook to commit the sync-to-pantry checkout action. Returns unrecognized catalog items.
 */
export function useSyncToPantry(listId: string) {
  const queryClient = useQueryClient();
  return useMutation<SyncToPantryResponse, Error, { householdId?: string } | undefined>({
    mutationFn: (variables) => {
      const headers: Record<string, string> = {};
      if (variables?.householdId) {
        headers["X-Household-ID"] = variables.householdId;
      }
      return shoppingClient
        .post(`api/v1/shopping-lists/${listId}/sync-to-pantry`, { headers })
        .json()
        .then((data) => SyncToPantryResponseSchema.parse(data));
    },
    onSuccess: () => {
      // Clear completed items since they are synced to pantry and deleted from local checklist
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
    },
  });
}

/**
 * Hook to record new product blueprints in the central Pantry catalog.
 */
export function useCreatePantryProduct() {
  return useMutation<any, Error, PantryProductCreatePayload>({
    mutationFn: ({ householdId, ...payload }) => {
      const headers: Record<string, string> = {};
      if (householdId) {
        headers["X-Household-ID"] = householdId;
      }
      return pantryClient
        .post("api/v1/products", { json: payload, headers })
        .json()
        .then((data) => ProductReadSchema.parse(data));
    },
  });
}
