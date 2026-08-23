import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shoppingClient } from "@/lib/api";
import { z } from "zod";
import { ShoppingListSchema } from "../schemas";
import { ShoppingList, ShoppingListCreatePayload } from "../types";

export * from "./shoppingItemService";
export * from "./pantrySyncService";

// --- Shopping Lists Query Keys ---
export const shoppingKeys = {
  all: ["shopping-lists"] as const,
  lists: () => [...shoppingKeys.all, "lists"] as const,
  list: (id: string) => [...shoppingKeys.all, "list", id] as const,
};

/**
 * Hook to retrieve all shopping lists scoped by household.
 */
export function useShoppingLists() {
  return useQuery<ShoppingList[]>({
    queryKey: shoppingKeys.lists(),
    queryFn: () =>
      shoppingClient
        .get("api/v1/shopping-lists")
        .json()
        .then((data) => z.array(ShoppingListSchema).parse(data)),
  });
}

/**
 * Hook to retrieve details and checklist items for a specific shopping list.
 */
export function useShoppingListDetails(listId: string) {
  return useQuery<ShoppingList>({
    queryKey: shoppingKeys.list(listId),
    queryFn: () =>
      shoppingClient
        .get(`api/v1/shopping-lists/${listId}`)
        .json()
        .then((data) => ShoppingListSchema.parse(data)),
    enabled: !!listId,
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
