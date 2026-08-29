import { libraryClient } from "@/core/api";
import { MediaItem } from "@/features/catalog/types";
import {
  BoardGameLookupListResponse,
  BookLookupResponse,
  ItemFormData,
  MovieSeriesLookupListResponse,
} from "../types";

export async function lookupIsbn(isbn: string): Promise<BookLookupResponse> {
  const data = await libraryClient
    .get(`lookup/isbn`, { searchParams: { isbn } })
    .json<BookLookupResponse>();
  return data;
}

export async function lookupBgg(
  query: string
): Promise<BoardGameLookupListResponse> {
  const data = await libraryClient
    .get(`lookup/bgg`, { searchParams: { query } })
    .json<BoardGameLookupListResponse>();
  return data;
}

export async function lookupTmdb(
  query: string
): Promise<MovieSeriesLookupListResponse> {
  const data = await libraryClient
    .get(`lookup/tmdb`, { searchParams: { query } })
    .json<MovieSeriesLookupListResponse>();
  return data;
}

export async function createItem(formData: ItemFormData): Promise<MediaItem> {
  const data = await libraryClient
    .post("items", { json: formData })
    .json<MediaItem>();
  return data;
}

export async function updateItem(
  id: string,
  formData: Partial<ItemFormData>
): Promise<MediaItem> {
  const data = await libraryClient
    .put(`items/${id}`, { json: formData })
    .json<MediaItem>();
  return data;
}
