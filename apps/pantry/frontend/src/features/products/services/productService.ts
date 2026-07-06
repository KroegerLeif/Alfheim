import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ProductRead, ProductCreate } from "@/features/inventory/types";

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
      apiClient
        .get<ProductRead[]>("/api/v1/products", {
          params: { name, limit: 20 },
        })
        .then((res) => res.data),
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
      apiClient
        .get<ProductRead>(`/api/v1/products/barcode/${barcode}`)
        .then((res) => res.data),
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
      apiClient
        .get<ProductRead[]>("/api/v1/products")
        .then((res) => res.data),
  });
}

/**
 * Hook to create a new product blueprint.
 */
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation<ProductRead, any, ProductCreate>({
    mutationFn: (payload) =>
      apiClient
        .post<ProductRead>("/api/v1/products", payload)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

