import { useMutation } from "@tanstack/react-query";
import { sendCartToShopping } from "../api/shoppingApi";

/** Sends the given cart entries to the shopping app; resolves with which entries were added and which failed. */
export function useSendToShopping() {
  return useMutation({
    mutationFn: (names: string[]) => sendCartToShopping(names),
  });
}
