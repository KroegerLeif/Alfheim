import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { pantryClient } from "@/lib/api";
import { LocationRead, LocationCreate } from "@/features/inventory/types";

/**
 * Hook to retrieve the list of physical storage locations from the backend.
 */
export function useLocations() {
  return useQuery<LocationRead[]>({
    queryKey: ["locations"],
    queryFn: () => 
      pantryClient
        .get("api/v1/locations")
        .json<LocationRead[]>(),
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
