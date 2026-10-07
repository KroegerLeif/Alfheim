import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { useMemo, useState } from "react";
import { fetchProviders } from "@/features/providers";
import {
  CATALOG_PAGE_SIZE,
  fetchCatalogItems,
  fetchLocations,
} from "../api/catalogApi";
import { CategoryTab, MediaItem } from "../types";

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

  const itemsQuery = useInfiniteQuery({
    queryKey: ["catalog-items", { householdId }, filters],
    queryFn: ({ pageParam }) =>
      fetchCatalogItems(filters, pageParam, CATALOG_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const nextSkip = lastPage.skip + (lastPage.items ?? []).length;
      return (lastPage.items ?? []).length > 0 && nextSkip < lastPage.total
        ? nextSkip
        : undefined;
    },
    enabled: status === "ready",
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", { householdId }],
    queryFn: fetchLocations,
    enabled: status === "ready",
  });

  const providersQuery = useQuery({
    queryKey: ["providers", { householdId }],
    queryFn: () => fetchProviders(),
    enabled: status === "ready",
  });

  const locationsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of locationsQuery.data ?? []) {
      map.set(loc.id, loc.name);
    }
    return map;
  }, [locationsQuery.data]);

  // Items can shift between pages while the household edits the catalog, so drop repeats by id.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const unique: MediaItem[] = [];
    for (const page of itemsQuery.data?.pages ?? []) {
      for (const item of page.items ?? []) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          unique.push(item);
        }
      }
    }
    return unique;
  }, [itemsQuery.data]);

  const pages = itemsQuery.data?.pages ?? [];

  return {
    category,
    setCategory,
    query,
    setQuery,
    isCookbook,
    setIsCookbook,
    activeProvidersOnly,
    setActiveProvidersOnly,
    items,
    total: pages.length > 0 ? pages[pages.length - 1].total : 0,
    hasMore: itemsQuery.hasNextPage,
    loadMore: itemsQuery.fetchNextPage,
    isLoadingMore: itemsQuery.isFetchingNextPage,
    isLoadMoreError: itemsQuery.isFetchNextPageError,
    isLoading: itemsQuery.isLoading,
    isError: itemsQuery.isError && !itemsQuery.isFetchNextPageError,
    error: itemsQuery.error,
    locations: locationsQuery.data ?? [],
    locationsMap,
    providers: providersQuery.data ?? [],
    refetch: itemsQuery.refetch,
  };
}
