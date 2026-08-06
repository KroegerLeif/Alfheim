import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pantryClient } from "@/core/api";
import { ProductRead, ProductCreate } from "@/features/products/types";

export const productKeys = {
  all: ["products"] as const,
  search: (name?: string) => [...productKeys.all, "search", { name }] as const,
  barcode: (barcode: string) => [...productKeys.all, "barcode", barcode] as const,
};

/**
 * Hook to search products by name.
 */
export function useSearchProducts(name?: string) {
  return useQuery<ProductRead[]>({
    queryKey: productKeys.search(name),
    queryFn: () => 
      pantryClient
        .get("api/v1/products", {
          searchParams: {
            ...(name && { name }),
            limit: 20,
          },
        })
        .json<ProductRead[]>(),
    enabled: name !== undefined && name.trim().length > 0,
  });
}

/**
 * Hook to resolve a product by its barcode.
 */
export function useProductByBarcode(barcode: string, enabled = true) {
  return useQuery<ProductRead>({
    queryKey: productKeys.barcode(barcode),
    queryFn: () => 
      pantryClient
        .get(`api/v1/products/barcode/${barcode}`)
        .json<ProductRead>(),
    enabled: enabled && barcode.trim().length > 0,
    retry: false, // Don't retry since barcode lookup can fail on non-existent items
  });
}

/**
 * Hook to retrieve all products visible to the home space.
 */
export function useProducts() {
  return useQuery<ProductRead[]>({
    queryKey: productKeys.all,
    queryFn: () => 
      pantryClient
        .get("api/v1/products")
        .json<ProductRead[]>(),
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
