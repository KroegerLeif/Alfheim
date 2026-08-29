import { MediaType } from "../catalog/types";

export type LookupType = "ISBN" | "BGG" | "TMDB";

export interface BookLookupResponse {
  title: string;
  media_type: MediaType;
  author_creator?: string | null;
  description?: string | null;
  isbn_gtin?: string | null;
  cover_image_url?: string | null;
  publisher?: string | null;
  published_date?: string | null;
}

export interface BoardGameLookupResponse {
  id?: string | null;
  title: string;
  media_type: MediaType;
  author_creator?: string | null;
  description?: string | null;
  min_players?: number | null;
  max_players?: number | null;
  runtime_minutes?: number | null;
  cover_image_url?: string | null;
  categories?: string[];
}

export interface BoardGameLookupListResponse {
  results: BoardGameLookupResponse[];
  total: number;
}

export interface MovieSeriesLookupResponse {
  id?: string | null;
  title: string;
  media_type: MediaType;
  author_creator?: string | null;
  description?: string | null;
  runtime_minutes?: number | null;
  fsk_rating?: number | null;
  cover_image_url?: string | null;
  release_year?: number | null;
}

export interface MovieSeriesLookupListResponse {
  results: MovieSeriesLookupResponse[];
  total: number;
}

export interface ItemFormData {
  title: string;
  media_type: MediaType;
  location_id?: string | null;
  author_creator?: string | null;
  description?: string | null;
  is_cookbook: boolean;
  isbn_gtin?: string | null;
  min_players?: number | null;
  max_players?: number | null;
  runtime_minutes?: number | null;
  fsk_rating?: number | null;
  cover_image_url?: string | null;
  provider_id?: string | null;
}
