import { libraryClient } from "@/core/api";
import {
  CatalogFilters,
  ItemListResponse,
  LocationItem,
} from "../types";

/** Items requested per page; divisible by the 1, 2, 3 and 4 column grid layouts. */
export const CATALOG_PAGE_SIZE = 48;

export async function fetchCatalogItems(
  filters: CatalogFilters,
  skip = 0,
  limit = CATALOG_PAGE_SIZE
): Promise<ItemListResponse> {
  const searchParams = new URLSearchParams();

  if (filters.query?.trim()) {
    searchParams.set("q", filters.query.trim());
  }

  if (filters.category && filters.category !== "ALL") {
    searchParams.set("media_type", filters.category);
  }

  if (filters.isCookbook) {
    searchParams.set("is_cookbook", "true");
  }

  if (filters.activeProvidersOnly) {
    searchParams.set("active_providers_only", "true");
  }

  searchParams.set("skip", String(skip));
  searchParams.set("limit", String(limit));

  return libraryClient.get(`search?${searchParams.toString()}`).json<ItemListResponse>();
}

export async function fetchLocations(): Promise<LocationItem[]> {
  const data = await libraryClient.get("locations").json<LocationItem[]>();
  return data;
}
