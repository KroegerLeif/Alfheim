"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { describeApiError } from "@/lib/apiError";
import type { UnrecognizedShoppingItem } from "../types";
import {
  useCreatePantryProduct,
  useDeleteShoppingItem,
  useSyncToPantry,
  useUpdateShoppingItem,
} from "../services/shoppingListService";

export interface LocalStateItem extends UnrecognizedShoppingItem {
  resolved: "pending" | "saved" | "ignored" | "skipped";
  name: string;
  quantity: number;
  unit: string;
  catalogName?: string;
  /** Pantry product created for this item; kept so a failed stock-in can be retried without a duplicate. */
  catalogProductId?: string;
}

const REASON_KEYS: Record<string, string> = {
  "pantry.error.product_not_found": "reasonProductNotFound",
  "pantry.error.invalid_unit": "reasonInvalidUnit",
  "pantry.error.incompatible_units": "reasonIncompatibleUnits",
  "pantry.error.system_location_missing": "reasonSystemLocationMissing",
};

/** Pantry stores weights in g, volumes in ml and everything else as pieces. */
function toBaseUnit(unit: string): "g" | "ml" | "piece" {
  const u = unit.toLowerCase();
  if (u === "g" || u === "kg") return "g";
  if (u === "ml" || u === "l") return "ml";
  return "piece";
}

/**
 * State and actions of the stock-in dialog: resolving the items Pantry could not match.
 *
 * Saving an item to the catalog runs end to end: create the Pantry product, align the shopping item's
 * name with it, then retry the sync for that single item so the item is linked to the product and
 * stocked. Every failing step rejects with a localized message the row shows.
 */
export function useEinlagernItems(listId: string, initialItems: UnrecognizedShoppingItem[], householdId: string) {
  const t = useTranslations("Modal");
  const tError = useTranslations("Error");
  const [items, setItems] = useState<LocalStateItem[]>(() =>
    (initialItems ?? []).map((i) => ({ ...i, resolved: "pending" }))
  );

  const createProduct = useCreatePantryProduct();
  const updateItem = useUpdateShoppingItem(listId, { silent: true });
  const deleteItem = useDeleteShoppingItem(listId);
  const syncToPantry = useSyncToPantry(listId);

  const patchItem = (id: string, patch: Partial<LocalStateItem>) =>
    setItems((prev) => prev.map((i) => (i.shopping_item_id === id ? { ...i, ...patch } : i)));

  const persistEdit = async (id: string, changes: { name?: string; quantity?: number; unit?: string }) => {
    try {
      await updateItem.mutateAsync({ itemId: id, payload: changes });
    } catch (err) {
      throw new Error(describeApiError(err, t("editFailed"), tError("unreachable")));
    }
    patchItem(id, changes);
  };

  const saveToCatalog = async (id: string, catalogName: string) => {
    const item = items.find((i) => i.shopping_item_id === id);
    if (!item) return;

    let productId = item.catalogProductId;
    if (!productId) {
      try {
        const product = await createProduct.mutateAsync({
          name: catalogName,
          brand: item.brand ?? null,
          barcode: item.barcode ?? null,
          base_unit: toBaseUnit(item.unit),
          minimum_stock: 0.0,
          householdId,
        });
        productId = product.id;
        patchItem(id, { catalogProductId: product.id });
      } catch (err) {
        throw new Error(describeApiError(err, t("catalogFailed"), tError("unreachable")));
      }
    }

    // Pantry matches by barcode or exact name, so the item takes the catalog name.
    if (catalogName !== item.name) await persistEdit(id, { name: catalogName });

    let result;
    try {
      result = await syncToPantry.mutateAsync({ householdId, itemIds: [id] });
    } catch (err) {
      throw new Error(describeApiError(err, t("retrySyncFailed"), tError("unreachable")));
    }
    const stillOpen = (result.unrecognized_items ?? []).find((u) => u.shopping_item_id === id);
    if (stillOpen) throw new Error(t(REASON_KEYS[stillOpen.reason] ?? "stillUnrecognized"));
    patchItem(id, { resolved: "saved", catalogName });
  };

  const skip = (id: string) => patchItem(id, { resolved: "skipped" });

  const remove = (id: string) =>
    deleteItem.mutate(id, { onSuccess: () => patchItem(id, { resolved: "ignored" }) });

  return {
    items,
    pendingCount: items.filter((i) => i.resolved === "pending").length,
    isCreatingProduct: createProduct.isPending || syncToPantry.isPending,
    persistEdit,
    saveToCatalog,
    skip,
    remove,
  };
}
