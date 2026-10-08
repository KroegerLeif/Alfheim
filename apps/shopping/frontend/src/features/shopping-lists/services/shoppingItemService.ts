import { useMutation, useQueryClient } from "@tanstack/react-query";
import { shoppingClient } from "@/lib/api";
import { useErrorNotifier } from "@/lib/useErrorNotifier";
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

/** Prefix of the client-generated id an item carries until the server has confirmed it. */
export const TEMP_ITEM_ID_PREFIX = "temp-";

/** True while an item only exists in the optimistic cache, so the server does not know its id yet. */
export const isPendingItem = (item: Pick<ShoppingItem, "id">): boolean =>
  item.id.startsWith(TEMP_ITEM_ID_PREFIX);

interface AddItemContext {
  previousList: ShoppingList | undefined;
  tempId: string;
}

/**
 * Hook to add a new shopping item with optimistic updates.
 *
 * The optimistic item carries a `temp-` id (see `isPendingItem`) so the UI can block actions that
 * would reach the server with an id it does not know yet. It is swapped for the server's item on
 * success and removed again on failure.
 */
export function useAddShoppingItem(listId: string) {
  const queryClient = useQueryClient();
  const notifyError = useErrorNotifier();
  return useMutation<ShoppingItem, Error, ShoppingItemCreatePayload, AddItemContext>({
    mutationFn: (payload) =>
      shoppingClient
        .post(`api/v1/shopping-lists/${listId}/items`, { json: payload })
        .json()
        .then((data) => ShoppingItemSchema.parse(data)),
    onMutate: async (newItemPayload) => {
      // Cancel outgoing queries to prevent overwrites
      await queryClient.cancelQueries({ queryKey: shoppingKeys.list(listId) });

      const previousList = queryClient.getQueryData<ShoppingList>(shoppingKeys.list(listId));
      const tempId = `${TEMP_ITEM_ID_PREFIX}${generateUUID()}`;

      if (previousList) {
        const tempItem: ShoppingItem = {
          id: tempId,
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

      return { previousList, tempId };
    },
    onSuccess: (created, _payload, context) => {
      // Swap the optimistic item for the persisted one right away instead of waiting for the refetch.
      queryClient.setQueryData<ShoppingList>(shoppingKeys.list(listId), (current) =>
        current
          ? { ...current, items: current.items.map((item) => (item.id === context?.tempId ? created : item)) }
          : current
      );
    },
    onError: (err, newItem, context) => {
      // Revert state if backend request fails
      if (context?.previousList) {
        queryClient.setQueryData(shoppingKeys.list(listId), context.previousList);
      }
      notifyError(err, "itemAddFailed");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
    },
  });
}

/**
 * Hook to update a shopping item properties (checked state, qty, unit) optimistically.
 *
 * Failures are shown as a notification unless `silent` is set, for callers that present the
 * error themselves (the mutation still rejects `mutateAsync`).
 */
export function useUpdateShoppingItem(listId: string, { silent = false }: { silent?: boolean } = {}) {
  const queryClient = useQueryClient();
  const notifyError = useErrorNotifier();
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
      if (!silent) notifyError(err, "itemUpdateFailed");
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
  const notifyError = useErrorNotifier();
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
      notifyError(err, "itemDeleteFailed");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
    },
  });
}
