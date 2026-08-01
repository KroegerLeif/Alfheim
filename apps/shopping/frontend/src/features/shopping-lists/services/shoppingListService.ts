import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shoppingClient, pantryClient } from "@/lib/api";
import { z } from "zod";
import {
  ShoppingItemSchema,
  ShoppingListSchema,
  SyncToPantryResponseSchema,
  ProductReadSchema,
} from "../schemas";
import {
  ShoppingItem,
  ShoppingList,
  ShoppingItemCreatePayload,
  ShoppingItemUpdatePayload,
  ShoppingListCreatePayload,
  SyncToPantryResponse,
} from "../types";

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
  return useMutation<SyncToPantryResponse, Error, void>({
    mutationFn: () =>
      shoppingClient
        .post(`api/v1/shopping-lists/${listId}/sync-to-pantry`)
        .json()
        .then((data) => SyncToPantryResponseSchema.parse(data)),
    onSuccess: () => {
      // Clear completed items since they are synced to pantry and deleted from local checklist
      queryClient.invalidateQueries({ queryKey: shoppingKeys.list(listId) });
    },
  });
}

// --- Pantry Catalog Resolution Support ---

export interface PantryProductCreatePayload {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  base_unit: string;
  minimum_stock: number;
  category_id?: string | null;
}

/**
 * Hook to record new product blueprints in the central Pantry catalog.
 */
export function useCreatePantryProduct() {
  return useMutation<any, Error, PantryProductCreatePayload>({
    mutationFn: (payload) =>
      pantryClient
        .post("api/v1/products", { json: payload })
        .json()
        .then((data) => ProductReadSchema.parse(data)),
  });
}

export interface Household {
  id: string;
  name: string;
  is_default?: boolean;
}

/**
 * Hook to retrieve user households for target pantry storage.
 */
export function useHouseholds() {
  return useQuery<Household[]>({
    queryKey: ["households", "me"],
    queryFn: async () => {
      try {
        const res = await shoppingClient.get("api/v1/households/me").json<Household[]>();
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  });
}
