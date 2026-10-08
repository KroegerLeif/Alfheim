import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { pantryClient } from "@/core/api";
import { fetchAllPages } from "@/core/pagination";
import { LocationRead, LocationCreate, LocationUpdate } from "@/features/locations/types";

/**
 * Hook to retrieve the list of physical storage locations from the backend.
 */
export function useLocations() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<LocationRead[]>({
    queryKey: ["locations", { householdId }],
    queryFn: () => fetchAllPages<LocationRead>("api/v1/locations"),
    enabled: status === "ready",
  });
}

/**
 * Hook to create a new physical storage location.
 */
export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation<LocationRead, Error, LocationCreate>({
    mutationFn: (payload) =>
      pantryClient
        .post("api/v1/locations", { json: payload })
        .json<LocationRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}

/**
 * Hook to rename or re-describe a custom storage location (PATCH /locations/{id}).
 */
export function useUpdateLocation() {
  const queryClient = useQueryClient();

  return useMutation<LocationRead, Error, { id: string; payload: LocationUpdate }>({
    mutationFn: ({ id, payload }) =>
      pantryClient
        .patch(`api/v1/locations/${id}`, { json: payload })
        .json<LocationRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      // Stock lines and ledger rows embed or resolve the location name.
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

/**
 * Hook to delete a custom storage location (DELETE /locations/{id}). The server answers 409
 * `location_in_use` while the location still holds stock or has transaction history.
 */
export function useDeleteLocation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await pantryClient.delete(`api/v1/locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}
