import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { LocationRead, LocationCreate } from "@/features/inventory/types";

/**
 * Hook to retrieve the list of physical storage locations from the backend.
 */
export function useLocations() {
  return useQuery<LocationRead[]>({
    queryKey: ["locations"],
    queryFn: () => 
      apiClient
        .get<LocationRead[]>("/api/v1/locations")
        .then((res) => res.data),
  });
}

/**
 * Hook to create a new physical storage location.
 */
export function useCreateLocation() {
  const queryClient = useQueryClient();

  return useMutation<LocationRead, any, LocationCreate>({
    mutationFn: (payload) =>
      apiClient
        .post<LocationRead>("/api/v1/locations", payload)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
  });
}

