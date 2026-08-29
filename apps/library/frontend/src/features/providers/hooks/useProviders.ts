import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProvider,
  deleteProvider,
  fetchProviders,
  updateProvider,
} from "../api/providersApi";
import { ProviderCreatePayload, ProviderUpdatePayload } from "../types";

export function useProviders() {
  const queryClient = useQueryClient();

  const providersQuery = useQuery({
    queryKey: ["providers"],
    queryFn: () => fetchProviders(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: ProviderCreatePayload) => createProvider(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ProviderUpdatePayload }) =>
      updateProvider(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-items"] });
    },
  });

  const toggleActive = (id: string, currentStatus: boolean) => {
    updateMutation.mutate({ id, payload: { is_active: !currentStatus } });
  };

  return {
    providers: providersQuery.data ?? [],
    isLoading: providersQuery.isLoading,
    isError: providersQuery.isError,
    error: providersQuery.error,
    createProvider: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateProvider: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteProvider: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    toggleActive,
    refetch: providersQuery.refetch,
  };
}
