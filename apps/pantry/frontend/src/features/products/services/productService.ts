import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ProductRead } from "@/features/inventory/types";

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
