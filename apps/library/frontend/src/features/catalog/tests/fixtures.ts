import type { MediaItem } from "../types";

export function makeItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "item-1",
    household_id: "hh-1",
    title: "Dune",
    media_type: "BOOK",
    is_cookbook: false,
    status: "AVAILABLE",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}
