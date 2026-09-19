import { useQuery } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { useMemo, useState } from "react";
import { fetchCatalogItems, fetchLocations } from "../api/catalogApi";
import { CategoryTab, LocationItem } from "../types";

export function useCatalog() {
  const { householdId, status } = useActiveHousehold();
  const [category, setCategory] = useState<CategoryTab>("ALL");
  const [query, setQuery] = useState<string>("");
  const [isCookbook, setIsCookbook] = useState<boolean>(false);
  const [activeProvidersOnly, setActiveProvidersOnly] = useState<boolean>(false);

  const filters = useMemo(
    () => ({
      category,
      query,
      isCookbook,
      activeProvidersOnly,
    }),
    [category, query, isCookbook, activeProvidersOnly]
  );

  const itemsQuery = useQuery({
    queryKey: ["catalog-items", { householdId }, filters],
    queryFn: () => fetchCatalogItems(filters),
    enabled: status === "ready",
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", { householdId }],
    queryFn: fetchLocations,
    enabled: status === "ready",
  });

  const locationsMap = useMemo(() => {
    const map = new Map<string, string>();
    if (locationsQuery.data) {
      const traverse = (locs: LocationItem[]) => {
        for (const loc of locs) {
          map.set(loc.id, loc.name);
        }
      };
      traverse(locationsQuery.data);
    }
    return map;
  }, [locationsQuery.data]);

  return {
    category,
    setCategory,
    query,
    setQuery,
    isCookbook,
    setIsCookbook,
    activeProvidersOnly,
    setActiveProvidersOnly,
    items: itemsQuery.data?.items ?? [],
    total: itemsQuery.data?.total ?? 0,
    isLoading: itemsQuery.isLoading,
    isError: itemsQuery.isError,
    error: itemsQuery.error,
    locations: locationsQuery.data ?? [],
    locationsMap,
    refetch: itemsQuery.refetch,
  };
}
