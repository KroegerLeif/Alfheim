import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pantryClient } from "@/core/api";
import { CategoryRead, CategoryCreate } from "@/features/categories/types";

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

