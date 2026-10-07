import { shoppingClient } from "@/core/api";

/** Outcome of pushing a cart to the shopping list: names that were added and names that were rejected. */
export interface SendCartResult {
  sent: string[];
  failed: string[];
}

/**
 * Adds one part to the household shopping list through the shopping app's public API. The shopping backend
 * puts it on the household list of the active household (X-Household-ID).
 */
const pushItem = async (name: string): Promise<void> => {
  await shoppingClient.post("shopping/items", { json: { name, quantity: 1, unit: "piece" } });
};

/**
 * Pushes every cart entry to the shopping list. A failing entry never blocks the others, so the caller can
 * keep exactly the entries that did not arrive.
 */
export const sendCartToShopping = async (names: string[]): Promise<SendCartResult> => {
  const outcomes = await Promise.allSettled(names.map((name) => pushItem(name)));
  const result: SendCartResult = { sent: [], failed: [] };
  outcomes.forEach((outcome, index) => {
    if (outcome.status === "fulfilled") result.sent.push(names[index]);
    else result.failed.push(names[index]);
  });
  return result;
};
