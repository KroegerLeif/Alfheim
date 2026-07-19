import { useQuery } from "@tanstack/react-query";
import { pantryClient } from "@/lib/api";
import { CategoryRead } from "@/features/inventory/types";

/**
 * Hook to retrieve product category classifications from the backend.
 */
export function useCategories() {
  return useQuery<CategoryRead[]>({
    queryKey: ["categories"],
    queryFn: () => 
      pantryClient
        .get("api/v1/categories")
        .json<CategoryRead[]>(),
  });
}
