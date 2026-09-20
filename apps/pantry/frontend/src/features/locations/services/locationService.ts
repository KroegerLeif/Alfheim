import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { pantryClient } from "@/core/api";
import { LocationRead, LocationCreate } from "@/features/locations/types";

/**
 * Hook to retrieve the list of physical storage locations from the backend.
 */
export function useLocations() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<LocationRead[]>({
    queryKey: ["locations", { householdId }],
    queryFn: () =>
      pantryClient
        .get("api/v1/locations")
        .json<LocationRead[]>(),
    enabled: status === "ready",
  });
}

/**
 * Hook to create a new physical storage location.
 */
export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation<LocationRead, any, LocationCreate>({
    mutationFn: (payload) =>
      pantryClient
        .post("api/v1/locations", { json: payload })
        .json<LocationRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}
