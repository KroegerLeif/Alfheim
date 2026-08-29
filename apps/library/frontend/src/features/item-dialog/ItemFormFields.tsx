"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import { LocationItem, MediaType } from "@/features/catalog/types";
import { MediaSpecificFields } from "./MediaSpecificFields";
import { ItemFormData } from "./types";

interface ItemFormFieldsProps {
  formData: ItemFormData;
  onChange: (updates: Partial<ItemFormData>) => void;
  locations: LocationItem[];
}

export function ItemFormFields({
  formData,
  onChange,
  locations,
}: ItemFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      <div className="sm:col-span-2">
        <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
          {t("library.itemDialog.title")} *
        </label>
        <input
          type="text"
          required
          value={formData.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
          {t("library.itemDialog.mediaType")} *
        </label>
        <select
          value={formData.media_type}
          onChange={(e) => onChange({ media_type: e.target.value as MediaType })}
          className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="BOOK">{t("library.catalog.filterBooks")}</option>
          <option value="GAME">{t("library.catalog.filterBoardGames")}</option>
          <option value="MOVIE">{t("library.catalog.filterMovies")}</option>
          <option value="SERIES">{t("library.catalog.filterSeries")}</option>
        </select>
      </div>

      <div>
        <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
          {t("library.itemDialog.location")}
        </label>
        <select
          value={formData.location_id || ""}
          onChange={(e) => onChange({ location_id: e.target.value || null })}
          className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("library.itemDialog.noLocation")}</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
          {t("library.itemDialog.creator")}
        </label>
        <input
          type="text"
          value={formData.author_creator || ""}
          onChange={(e) => onChange({ author_creator: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <MediaSpecificFields formData={formData} onChange={onChange} />

      <div className="sm:col-span-2">
        <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
          {t("library.itemDialog.coverUrl")}
        </label>
        <input
          type="url"
          value={formData.cover_image_url || ""}
          onChange={(e) => onChange({ cover_image_url: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-[var(--text-muted,#94a3b8)] mb-1 font-medium">
          {t("library.itemDialog.description")}
        </label>
        <textarea
          rows={3}
          value={formData.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>
    </div>
  );
}
