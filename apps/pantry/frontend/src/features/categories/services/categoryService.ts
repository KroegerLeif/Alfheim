import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { CategoryRead } from "@/features/inventory/types";

/**
 * Hook to retrieve product category classifications from the backend.
 */
export function useCategories() {
  return useQuery<CategoryRead[]>({
    queryKey: ["categories"],
    queryFn: () => 
      apiClient
        .get<CategoryRead[]>("/api/v1/categories")
        .then((res) => res.data),
  });
}
