import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { shoppingClient } from "@/lib/api";

const ShoppingCapabilitiesSchema = z.object({ pantry_available: z.boolean() });

export type ShoppingCapabilities = z.infer<typeof ShoppingCapabilitiesSchema>;

export const capabilitiesKey = ["shopping", "capabilities"] as const;

/** Optional integrations of this installation (GET /api/v1/shopping/capabilities). */
export function useShoppingCapabilities() {
  return useQuery<ShoppingCapabilities>({
    queryKey: capabilitiesKey,
    queryFn: () =>
      shoppingClient
        .get("shopping/capabilities")
        .json()
        .then((data) => ShoppingCapabilitiesSchema.parse(data)),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Whether the Pantry app is installed. Unknown (loading or failed) counts as absent, so the
 * sync controls only appear once the backend confirmed they can work.
 */
export function usePantryAvailable(): boolean {
  const { data } = useShoppingCapabilities();
  return data?.pantry_available ?? false;
}
