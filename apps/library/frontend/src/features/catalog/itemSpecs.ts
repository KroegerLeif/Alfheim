import { MediaItem } from "./types";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Short, localized spec chips (player count, runtime, age rating) for a catalog item. */
export function getItemSpecs(item: MediaItem, t: Translate): string[] {
  const specs: string[] = [];

  if (item.min_players) {
    if (item.max_players && item.max_players > item.min_players) {
      specs.push(
        t("library.catalog.players", {
          min: item.min_players,
          max: item.max_players,
        })
      );
    } else {
      specs.push(t("library.catalog.playersSingle", { count: item.min_players }));
    }
  }

  if (item.runtime_minutes) {
    specs.push(t("library.catalog.runtime", { minutes: item.runtime_minutes }));
  }

  if (item.fsk_rating !== null && item.fsk_rating !== undefined) {
    specs.push(t("library.catalog.fsk", { age: item.fsk_rating }));
  }

  return specs;
}

const MEDIA_TYPE_LABEL_KEYS: Record<string, string> = {
  BOOK: "library.catalog.filterBooks",
  GAME: "library.catalog.filterBoardGames",
  MOVIE: "library.catalog.filterMovies",
  SERIES: "library.catalog.filterSeries",
};

/** Translation key for a media type badge, or null for an unknown type. */
export function getMediaTypeLabelKey(mediaType: string): string | null {
  return MEDIA_TYPE_LABEL_KEYS[mediaType] ?? null;
}
