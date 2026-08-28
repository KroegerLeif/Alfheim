import React from "react";
import { Badge, useTranslation } from "@alfheim/shared";
import { MediaItem } from "../types";

interface ItemCardProps {
  item: MediaItem;
  locationName?: string;
}

export function ItemCard({ item, locationName }: ItemCardProps) {
  const { t } = useTranslation();

  const renderMediaTypeBadge = () => {
    switch (item.media_type) {
      case "BOOK":
        return <Badge variant="secondary">{t("library.catalog.filterBooks")}</Badge>;
      case "GAME":
        return <Badge variant="secondary">{t("library.catalog.filterBoardGames")}</Badge>;
      case "MOVIE":
        return <Badge variant="secondary">{t("library.catalog.filterMovies")}</Badge>;
      case "SERIES":
        return <Badge variant="secondary">{t("library.catalog.filterSeries")}</Badge>;
      default:
        return <Badge variant="secondary">{item.media_type}</Badge>;
    }
  };

  const renderSpecs = () => {
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
        specs.push(
          t("library.catalog.playersSingle", { count: item.min_players })
        );
      }
    }

    if (item.runtime_minutes) {
      specs.push(
        t("library.catalog.runtime", { minutes: item.runtime_minutes })
      );
    }

    if (item.fsk_rating !== null && item.fsk_rating !== undefined) {
      specs.push(t("library.catalog.fsk", { age: item.fsk_rating }));
    }

    return specs;
  };

  const isLent = item.status === "LENT_OUT";
  const specs = renderSpecs();

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 hover:shadow-lg ${
        item.is_cookbook
          ? "border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent"
          : "border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)]"
      }`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--surface-muted,#0f172a)] flex items-center justify-center">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-[var(--text-muted,#64748b)]">
            <span className="text-3xl font-bold tracking-wider opacity-60">
              {item.media_type.charAt(0)}
            </span>
          </div>
        )}

        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {renderMediaTypeBadge()}
          {item.is_cookbook && (
            <Badge className="bg-amber-600 text-white border-none">
              📖 {t("library.catalog.filterCookbooks")}
            </Badge>
          )}
        </div>

        <div className="absolute top-2 right-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
              isLent
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            }`}
          >
            {isLent
              ? t("library.lending.statusLent")
              : t("library.lending.statusAvailable")}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        <div>
          <h3 className="font-bold text-base text-[var(--text-main,#f8fafc)] line-clamp-1 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          {item.author_creator && (
            <p className="text-xs text-[var(--text-muted,#94a3b8)] line-clamp-1 mt-0.5">
              {item.author_creator}
            </p>
          )}
          {item.description && (
            <p className="text-xs text-[var(--text-muted,#64748b)] line-clamp-2 mt-2">
              {item.description}
            </p>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle,#334155)]">
          {locationName && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted,#94a3b8)]">
              <span className="font-medium">📍 {locationName}</span>
            </div>
          )}

          {specs.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-muted,#94a3b8)]">
              {specs.map((spec, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-[var(--surface-muted,#0f172a)] border border-[var(--border-subtle,#334155)]"
                >
                  {spec}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
