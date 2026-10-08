import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { pantryClient } from "@/core/api";
import { fetchAllPages } from "@/core/pagination";
import { CategoryRead, CategoryCreate, CategoryUpdate } from "@/features/categories/types";

/**
 * Hook to retrieve product category classifications from the backend.
 */
export function useCategories() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<CategoryRead[]>({
    queryKey: ["categories", { householdId }],
    queryFn: () => fetchAllPages<CategoryRead>("api/v1/categories"),
    enabled: status === "ready",
  });
}

/**
 * Hook to create a new product category.
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation<CategoryRead, Error, CategoryCreate>({
    mutationFn: (payload) =>
      pantryClient
        .post("api/v1/categories", { json: payload })
        .json<CategoryRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

/**
 * Hook to rename or re-describe a custom category (PATCH /categories/{id}).
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation<CategoryRead, Error, { id: string; payload: CategoryUpdate }>({
    mutationFn: ({ id, payload }) =>
      pantryClient
        .patch(`api/v1/categories/${id}`, { json: payload })
        .json<CategoryRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

/**
 * Hook to delete a custom category (DELETE /categories/{id}). The server answers 409 `category_in_use`
 * while products still reference it.
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await pantryClient.delete(`api/v1/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
