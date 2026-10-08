import React from "react";
import { BookOpen, FileText, MapPin } from "lucide-react";
import { Badge, Button, useTranslation } from "@alfheim/shared";
import { getItemSpecs, getMediaTypeLabelKey } from "../itemSpecs";
import { MediaItem } from "../types";

interface ItemCardProps {
  item: MediaItem;
  locationName?: string;
  onEdit?: () => void;
  onLend?: (item: MediaItem) => void;
  onReturn?: (item: MediaItem) => void;
}

export function ItemCard({
  item,
  locationName,
  onEdit,
  onLend,
  onReturn,
}: ItemCardProps) {
  const { t } = useTranslation();

  const mediaTypeKey = getMediaTypeLabelKey(item.media_type);

  const isLent = item.status === "LENT_OUT";
  const specs = getItemSpecs(item, t);

  return (
    <div
      onClick={onEdit}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 hover:shadow-lg ${
        onEdit ? "cursor-pointer" : ""
      } ${
        item.is_cookbook
          ? "border-amber-500/40 bg-gradient-to-b from-amber-500/5 to-transparent"
          : "border-[var(--border-subtle)] bg-[var(--surface-card)]"
      }`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--surface-elevated)] flex items-center justify-center">
        {item.cover_image_url ? (
          <img
            src={item.cover_image_url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
            <span className="text-3xl font-bold tracking-wider opacity-60">
              {item.media_type.charAt(0)}
            </span>
          </div>
        )}

        <div className="absolute top-2 left-2 flex max-w-[60%] flex-wrap gap-1">
          <Badge variant="secondary">
            {mediaTypeKey ? t(mediaTypeKey) : item.media_type}
          </Badge>
          {item.is_cookbook && (
            <Badge className="gap-1 bg-amber-600 text-white border-none">
              <BookOpen className="h-3 w-3 shrink-0" aria-hidden="true" />
              {t("library.catalog.cookbook")}
            </Badge>
          )}
          {item.manual_s3_key && (
            <Badge className="gap-1 bg-emerald-600 text-white border-none">
              <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
              {t("library.catalog.manualBadge")}
            </Badge>
          )}
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-1">
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
          <h3 className="break-words font-bold text-base text-[var(--text-main)] line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          {item.author_creator && (
            <p className="break-words text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">
              {item.author_creator}
            </p>
          )}
          {item.description && (
            <p className="break-words text-xs text-[var(--text-muted)] line-clamp-2 mt-2">
              {item.description}
            </p>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
          {locationName && (
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate font-medium">{locationName}</span>
            </div>
          )}

          {specs.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)]">
              {specs.map((spec, idx) => (
                <span
                  key={idx}
                  className="max-w-full truncate px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border-subtle)]"
                >
                  {spec}
                </span>
              ))}
            </div>
          )}

          {(onLend || onReturn) && (
            <div className="pt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
              {!isLent && onLend && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => onLend(item)}
                >
                  {t("library.lending.lendItem")}
                </Button>
              )}
              {isLent && onReturn && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => onReturn(item)}
                >
                  {t("library.lending.markReturned")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
