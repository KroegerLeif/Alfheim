import { shoppingClient } from "@/core/api";
import { LowStockItem } from "../types";

/** Outcome of exporting low-stock products: the items that were added and the items that were rejected. */
export interface ShoppingExportResult {
  sent: LowStockItem[];
  failed: LowStockItem[];
}

/**
 * Adds one low-stock product to the household shopping list through the shopping app's public API. The
 * quantity is what is missing to reach the minimum stock, and at least one unit.
 */
async function pushItem({ product, current_stock }: LowStockItem): Promise<void> {
  await shoppingClient.post("shopping/items", {
    json: {
      name: product.name,
      brand: product.brand,
      barcode: product.barcode,
      quantity: Math.max(1, product.minimum_stock - current_stock),
      unit: product.base_unit || "piece",
      product_id: product.id,
    },
  });
}

/**
 * Exports every low-stock item. A failing item never blocks the others and is reported back, so the
 * caller can tell the user exactly which items did not arrive and offer to retry only those.
 */
export async function pushLowStockToShopping(items: LowStockItem[]): Promise<ShoppingExportResult> {
  const outcomes = await Promise.allSettled(items.map((item) => pushItem(item)));
  const result: ShoppingExportResult = { sent: [], failed: [] };
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") result.sent.push(items[index]);
    else result.failed.push(items[index]);
  });
  return result;
}
