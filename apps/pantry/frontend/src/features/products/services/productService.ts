import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { pantryClient } from "@/core/api";
import { ProductRead, ProductCreate } from "@/features/products/types";

export const productKeys = {
  /** Prefix for invalidation across every household. */
  all: ["products"] as const,
  list: (householdId: string | null) => [...productKeys.all, { householdId }] as const,
  search: (householdId: string | null, name?: string) =>
    [...productKeys.list(householdId), "search", { name }] as const,
  barcode: (householdId: string | null, barcode: string) =>
    [...productKeys.list(householdId), "barcode", barcode] as const,
};

/**
 * Hook to search products by name.
 */
export function useSearchProducts(name?: string) {
  const { householdId, status } = useActiveHousehold();
  return useQuery<ProductRead[]>({
    queryKey: productKeys.search(householdId, name),
    queryFn: () =>
      pantryClient
        .get("api/v1/products", {
          searchParams: {
            ...(name && { name }),
            limit: 20,
          },
        })
        .json<ProductRead[]>(),
    enabled: status === "ready" && name !== undefined && name.trim().length > 0,
  });
}

/**
 * Hook to resolve a product by its barcode.
 */
export function useProductByBarcode(barcode: string, enabled = true) {
  const { householdId, status } = useActiveHousehold();
  return useQuery<ProductRead>({
    queryKey: productKeys.barcode(householdId, barcode),
    queryFn: () =>
      pantryClient
        .get(`api/v1/products/barcode/${barcode}`)
        .json<ProductRead>(),
    enabled: status === "ready" && enabled && barcode.trim().length > 0,
    retry: false, // Don't retry since barcode lookup can fail on non-existent items
  });
}

/**
 * Hook to retrieve all products visible to the home space.
 */
export function useProducts() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<ProductRead[]>({
    queryKey: productKeys.list(householdId),
    queryFn: () =>
      pantryClient
        .get("api/v1/products")
        .json<ProductRead[]>(),
    enabled: status === "ready",
  });
}

/**
 * Hook to create a new product blueprint.
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation<ProductRead, any, ProductCreate>({
    mutationFn: (payload) =>
      pantryClient
        .post("api/v1/products", { json: payload })
        .json<ProductRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
