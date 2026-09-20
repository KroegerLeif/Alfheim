import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold, type Household as SharedHousehold } from "@alfheim/shared";
import { shoppingClient } from "@/lib/api";
import { z } from "zod";
import { ShoppingListSchema } from "../schemas";
import { ShoppingList, ShoppingListCreatePayload } from "../types";

export {
  useAddShoppingItem,
  useUpdateShoppingItem,
  useDeleteShoppingItem,
} from "./shoppingItemService";

export {
  useImportLowStock,
  useSyncToPantry,
  useCreatePantryProduct,
  type PantryProductCreatePayload,
} from "./pantrySyncService";

// --- Shopping Lists Query Keys ---
export const shoppingKeys = {
  all: ["shopping-lists"] as const,
  /** Prefix for invalidation across households. */
  lists: () => [...shoppingKeys.all, "lists"] as const,
  householdLists: (householdId: string | null) => [...shoppingKeys.lists(), { householdId }] as const,
  list: (id: string) => [...shoppingKeys.all, "list", id] as const,
};

/**
 * Hook to retrieve all shopping lists scoped by household.
 */
export function useShoppingLists() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<ShoppingList[]>({
    queryKey: shoppingKeys.householdLists(householdId),
    queryFn: () =>
      shoppingClient
        .get("api/v1/shopping-lists")
        .json()
        .then((data) => z.array(ShoppingListSchema).parse(data)),
    enabled: status === "ready",
  });
}

/**
 * Hook to retrieve details and checklist items for a specific shopping list.
 */
export function useShoppingListDetails(listId: string) {
  const { status } = useActiveHousehold();
  return useQuery<ShoppingList>({
    queryKey: shoppingKeys.list(listId),
    queryFn: () =>
      shoppingClient
        .get(`api/v1/shopping-lists/${listId}`)
        .json()
        .then((data) => ShoppingListSchema.parse(data)),
    enabled: status === "ready" && !!listId,
  });
}

/**
 * Hook to create a new shopping list.
 */
export function useCreateShoppingList() {
  const queryClient = useQueryClient();
  return useMutation<ShoppingList, Error, ShoppingListCreatePayload>({
    mutationFn: (payload) =>
      shoppingClient
        .post("api/v1/shopping-lists", { json: payload })
        .json()
        .then((data) => ShoppingListSchema.parse(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.lists() });
    },
  });
}

/**
 * Hook to delete an existing shopping list.
 */
export function useDeleteShoppingList() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (listId) =>
      shoppingClient
        .delete(`api/v1/shopping-lists/${listId}`)
        .then(() => {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.lists() });
    },
  });
}

/**
 * Hook to reorder shopping lists by display position index on the backend.
 */
export function useReorderShoppingLists() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: (listIds) =>
      shoppingClient
        .patch("api/v1/shopping-lists/reorder", { json: { list_ids: listIds } })
        .then(() => {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.lists() });
    },
  });
}

export type Household = SharedHousehold;

/**
 * The caller's households from the shared HouseholdProvider (core/household),
 * in the shape the list and pantry-target pickers expect.
 */
export function useHouseholds(): { data: Household[]; isLoading: boolean } {
  const { households, status } = useActiveHousehold();
  return { data: households, isLoading: status === "loading" };
}
