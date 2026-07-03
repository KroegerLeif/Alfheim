import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { LocationRead } from "@/features/inventory/types";

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
