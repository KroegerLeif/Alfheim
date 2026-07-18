import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shoppingClient } from "@/lib/api";
import { z } from "zod";
import { ShoppingHistorySchema } from "../schemas";
import { ShoppingHistory } from "../types";

// --- Shopping History Query Keys ---
export const historyKeys = {
  all: ["shopping-history"] as const,
};

/**
 * Hook to retrieve frequently purchased items history logs.
 */
export function useShoppingHistory() {
  return useQuery<ShoppingHistory[]>({
    queryKey: historyKeys.all,
    queryFn: () =>
      shoppingClient
        .get("api/v1/shopping-history")
        .json()
        .then((data) => z.array(ShoppingHistorySchema).parse(data)),
  });
}

/**
 * Hook to remove a specific item from the history quick-selection grids.
 */
export function useDeleteHistoryEntry() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (historyId) =>
      shoppingClient
        .delete(`api/v1/shopping-history/${historyId}`)
        .then(() => {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: historyKeys.all });
    },
  });
}
