"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import { ItemFormData } from "./types";

interface MediaSpecificFieldsProps {
  formData: ItemFormData;
  onChange: (updates: Partial<ItemFormData>) => void;
}

export function MediaSpecificFields({
  formData,
  onChange,
}: MediaSpecificFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      {formData.media_type === "BOOK" && (
        <>
          <div>
            <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
              {t("library.itemDialog.isbn")}
            </label>
            <input
              type="text"
              value={formData.isbn_gtin || ""}
              onChange={(e) => onChange({ isbn_gtin: e.target.value })}
              className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--text-main,#f8fafc)]">
              <input
                type="checkbox"
                checked={formData.is_cookbook}
                onChange={(e) => onChange({ is_cookbook: e.target.checked })}
                className="h-4 w-4 rounded border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] text-primary focus:ring-primary"
              />
              📖 {t("library.itemDialog.isCookbook")}
            </label>
          </div>
        </>
      )}

      {formData.media_type === "GAME" && (
        <>
          <div>
            <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
              {t("library.itemDialog.minPlayers")}
            </label>
            <input
              type="number"
              min={1}
              value={formData.min_players || ""}
              onChange={(e) =>
                onChange({ min_players: e.target.value ? parseInt(e.target.value, 10) : null })
              }
              className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
              {t("library.itemDialog.maxPlayers")}
            </label>
            <input
              type="number"
              min={1}
              value={formData.max_players || ""}
              onChange={(e) =>
                onChange({ max_players: e.target.value ? parseInt(e.target.value, 10) : null })
              }
              className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </>
      )}

      {(formData.media_type === "GAME" ||
        formData.media_type === "MOVIE" ||
        formData.media_type === "SERIES") && (
        <div>
          <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
            {t("library.itemDialog.playingTime")}
          </label>
          <input
            type="number"
            min={1}
            value={formData.runtime_minutes || ""}
            onChange={(e) =>
              onChange({ runtime_minutes: e.target.value ? parseInt(e.target.value, 10) : null })
            }
            className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {(formData.media_type === "MOVIE" || formData.media_type === "SERIES") && (
        <div>
          <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
            {t("library.itemDialog.fsk")}
          </label>
          <input
            type="number"
            min={0}
            max={18}
            value={formData.fsk_rating !== null && formData.fsk_rating !== undefined ? formData.fsk_rating : ""}
            onChange={(e) =>
              onChange({ fsk_rating: e.target.value !== "" ? parseInt(e.target.value, 10) : null })
            }
            className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}
    </>
  );
}
