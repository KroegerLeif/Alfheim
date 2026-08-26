import { useMutation, useQueryClient } from "@tanstack/react-query";
import { shoppingClient } from "@/lib/api";
import { ShoppingItemSchema } from "../schemas";
import {
  ShoppingItem,
  ShoppingList,
  ShoppingItemCreatePayload,
  ShoppingItemUpdatePayload,
} from "../types";
import { shoppingKeys } from "./shoppingListService";

// Fallback UUID generator for non-secure HTTP contexts where crypto.randomUUID is undefined
const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Hook to add a new shopping item with optimistic updates.
 */
export function useAddShoppingItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ShoppingItem,
    Error,
    ShoppingItemCreatePayload,
    { previousList: ShoppingList | undefined }
  >({
    mutationFn: (payload) =>
      shoppingClient
        .post(`api/v1/shopping-lists/${listId}/items`, { json: payload })
        .json()
        .then((data) => ShoppingItemSchema.parse(data)),
    onMutate: async (newItemPayload) => {
      // Cancel outgoing queries to prevent overwrites
      await queryClient.cancelQueries({ queryKey: shoppingKeys.list(listId) });

      const previousList = queryClient.getQueryData<ShoppingList>(shoppingKeys.list(listId));

      if (previousList) {
        // Enforce valid UUID string format for schema compliance
        const tempItem: ShoppingItem = {
          id: generateUUID(),
          list_id: listId,
          name: newItemPayload.name,
          brand: newItemPayload.brand || null,
          barcode: newItemPayload.barcode || null,
          quantity: newItemPayload.quantity,
          unit: newItemPayload.unit,
          is_completed: false,
          is_auto_generated: false,
          is_synced: false,
          product_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<ShoppingList>(shoppingKeys.list(listId), {
          ...previousList,
          items: [tempItem, ...previousList.items],
        });
      }

      return { previousList };
    },
    onError: (err, newItem, context) => {
      // Revert state if backend request fails
      if (context?.previousList) {
        queryClient.setQueryData(shoppingKeys.list(listId), context.previousList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
    },
  });
}

/**
 * Hook to update a shopping item properties (checked state, qty, unit) optimistically.
 */
export function useUpdateShoppingItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    ShoppingItem,
    Error,
    { itemId: string; payload: ShoppingItemUpdatePayload },
    { previousList: ShoppingList | undefined }
  >({
    mutationFn: ({ itemId, payload }) =>
      shoppingClient
        .patch(`api/v1/shopping-lists/${listId}/items/${itemId}`, { json: payload })
        .json()
        .then((data) => ShoppingItemSchema.parse(data)),
    onMutate: async ({ itemId, payload }) => {
      await queryClient.cancelQueries({ queryKey: shoppingKeys.list(listId) });

      const previousList = queryClient.getQueryData<ShoppingList>(shoppingKeys.list(listId));

      if (previousList) {
        queryClient.setQueryData<ShoppingList>(shoppingKeys.list(listId), {
          ...previousList,
          items: previousList.items.map((item) =>
            item.id === itemId
              ? { ...item, ...payload, updated_at: new Date().toISOString() }
              : item
          ),
        });
      }

      return { previousList };
    },
    onError: (err, variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(shoppingKeys.list(listId), context.previousList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
    },
  });
}

/**
 * Hook to delete a specific shopping item optimistically.
 */
export function useDeleteShoppingItem(listId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    string,
    { previousList: ShoppingList | undefined }
  >({
    mutationFn: (itemId) =>
      shoppingClient
        .delete(`api/v1/shopping-lists/${listId}/items/${itemId}`)
        .then(() => {}),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: shoppingKeys.list(listId) });

      const previousList = queryClient.getQueryData<ShoppingList>(shoppingKeys.list(listId));

      if (previousList) {
        queryClient.setQueryData<ShoppingList>(shoppingKeys.list(listId), {
          ...previousList,
          items: previousList.items.filter((item) => item.id !== itemId),
        });
      }

      return { previousList };
    },
    onError: (err, itemId, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(shoppingKeys.list(listId), context.previousList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
    },
  });
}
