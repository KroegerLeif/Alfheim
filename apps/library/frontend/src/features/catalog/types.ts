export type MediaType = "BOOK" | "GAME" | "MOVIE" | "SERIES";

export type LendingStatus = "AVAILABLE" | "LENT_OUT";

export interface MediaItem {
  id: string;
  household_id: string;
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
  status: LendingStatus;
  manual_s3_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationItem {
  id: string;
  household_id: string;
  name: string;
  parent_id?: string | null;
  location_type?: string | null;
  created_at?: string;
}

export interface ItemListResponse {
  items: MediaItem[];
  total: number;
  skip: number;
  limit: number;
}

export type CategoryTab = "ALL" | "BOOK" | "GAME" | "MOVIE" | "SERIES";

export interface CatalogFilters {
  query?: string;
  category: CategoryTab;
  isCookbook?: boolean;
  activeProvidersOnly?: boolean;
}
