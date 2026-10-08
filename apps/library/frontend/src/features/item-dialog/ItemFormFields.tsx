"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import { LocationItem, MediaType } from "@/features/catalog/types";
import type { ProviderSubscription } from "@/features/providers";
import { MediaSpecificFields } from "./MediaSpecificFields";
import { ItemFormData } from "./types";

interface ItemFormFieldsProps {
  formData: ItemFormData;
  onChange: (updates: Partial<ItemFormData>) => void;
  locations: LocationItem[];
  providers: ProviderSubscription[];
}

export function ItemFormFields({
  formData,
  onChange,
  locations,
  providers,
}: ItemFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      <div className="sm:col-span-2">
        <label htmlFor="item-title" className="block text-[var(--text-muted)] mb-1 font-medium">
          {t("library.itemDialog.title")} *
        </label>
        <input
          id="item-title"
          type="text"
          maxLength={255}
          required
          value={formData.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="item-media-type" className="block text-[var(--text-muted)] mb-1 font-medium">
          {t("library.itemDialog.mediaType")} *
        </label>
        <select
          id="item-media-type"
          value={formData.media_type}
          onChange={(e) => onChange({ media_type: e.target.value as MediaType })}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="BOOK">{t("library.catalog.filterBooks")}</option>
          <option value="GAME">{t("library.catalog.filterBoardGames")}</option>
          <option value="MOVIE">{t("library.catalog.filterMovies")}</option>
          <option value="SERIES">{t("library.catalog.filterSeries")}</option>
        </select>
      </div>

      <div>
        <label htmlFor="item-location" className="block text-[var(--text-muted)] mb-1 font-medium">
          {t("library.itemDialog.location")}
        </label>
        <select
          id="item-location"
          value={formData.location_id || ""}
          onChange={(e) => onChange({ location_id: e.target.value || null })}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
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
        <label htmlFor="item-provider" className="block text-[var(--text-muted)] mb-1 font-medium">
          {t("library.itemDialog.provider")}
        </label>
        <select
          id="item-provider"
          value={formData.provider_id || ""}
          onChange={(e) => onChange({ provider_id: e.target.value || null })}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("library.itemDialog.noProvider")}</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.is_active
                ? provider.provider_name
                : t("library.itemDialog.providerInactive", { name: provider.provider_name })}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="item-creator" className="block text-[var(--text-muted)] mb-1 font-medium">
          {t("library.itemDialog.creator")}
        </label>
        <input
          id="item-creator"
          type="text"
          maxLength={255}
          value={formData.author_creator || ""}
          onChange={(e) => onChange({ author_creator: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <MediaSpecificFields formData={formData} onChange={onChange} />

      <div className="sm:col-span-2">
        <label htmlFor="item-cover-url" className="block text-[var(--text-muted)] mb-1 font-medium">
          {t("library.itemDialog.coverUrl")}
        </label>
        <input
          id="item-cover-url"
          type="url"
          maxLength={1024}
          value={formData.cover_image_url || ""}
          onChange={(e) => onChange({ cover_image_url: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="item-description" className="block text-[var(--text-muted)] mb-1 font-medium">
          {t("library.itemDialog.description")}
        </label>
        <textarea
          id="item-description"
          rows={3}
          value={formData.description || ""}
          onChange={(e) => onChange({ description: e.target.value })}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>
    </div>
  );
}
