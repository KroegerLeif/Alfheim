import { libraryClient } from "@/core/api";
import {
  CatalogFilters,
  ItemListResponse,
  LocationItem,
} from "../types";

export async function fetchCatalogItems(
  filters: CatalogFilters
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

  const endpoint = searchParams.toString() ? `search?${searchParams.toString()}` : "search";
  const data = await libraryClient.get(endpoint).json<ItemListResponse>();
  return data;
}

export async function fetchLocations(): Promise<LocationItem[]> {
  const data = await libraryClient.get("locations").json<LocationItem[]>();
  return data;
}
