import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { pantryClient } from "@/core/api";
import { CategoryRead, CategoryCreate } from "@/features/categories/types";

/**
 * Hook to retrieve product category classifications from the backend.
 */
export function useCategories() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<CategoryRead[]>({
    queryKey: ["categories", { householdId }],
    queryFn: () =>
      pantryClient
        .get("api/v1/categories")
        .json<CategoryRead[]>(),
    enabled: status === "ready",
  });
}

/**
 * Hook to create a new product category.
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation<CategoryRead, any, CategoryCreate>({
    mutationFn: (payload) =>
      pantryClient
        .post("api/v1/categories", { json: payload })
        .json<CategoryRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
