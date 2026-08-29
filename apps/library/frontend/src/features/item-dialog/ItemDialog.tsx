"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useTranslation,
} from "@alfheim/shared";
import { LocationItem, MediaItem } from "@/features/catalog/types";
import { createItem, updateItem } from "./api/dialogApi";
import { ItemFormFields } from "./ItemFormFields";
import { MetadataLookupSection } from "./MetadataLookupSection";
import { ItemFormData } from "./types";

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: MediaItem | null;
  locations: LocationItem[];
  onSuccess: () => void;
}

const defaultFormData: ItemFormData = {
  title: "",
  media_type: "BOOK",
  location_id: null,
  author_creator: "",
  description: "",
  is_cookbook: false,
  isbn_gtin: "",
  min_players: null,
  max_players: null,
  runtime_minutes: null,
  fsk_rating: null,
  cover_image_url: "",
  provider_id: null,
};

export function ItemDialog({
  open,
  onOpenChange,
  item,
  locations,
  onSuccess,
}: ItemDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ItemFormData>(defaultFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title,
        media_type: item.media_type,
        location_id: item.location_id || null,
        author_creator: item.author_creator || "",
        description: item.description || "",
        is_cookbook: item.is_cookbook || false,
        isbn_gtin: item.isbn_gtin || "",
        min_players: item.min_players || null,
        max_players: item.max_players || null,
        runtime_minutes: item.runtime_minutes || null,
        fsk_rating: item.fsk_rating !== undefined ? item.fsk_rating : null,
        cover_image_url: item.cover_image_url || "",
        provider_id: item.provider_id || null,
      });
    } else {
      setFormData(defaultFormData);
    }
    setError(null);
  }, [item, open]);

  const handleFormChange = (updates: Partial<ItemFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      if (item?.id) {
        await updateItem(item.id, formData);
      } else {
        await createItem(formData);
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      setError(t("library.itemDialog.saveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] text-[var(--text-main,#f8fafc)]">
        <DialogHeader>
          <DialogTitle>
            {item ? t("library.itemDialog.editTitle") : t("library.itemDialog.createTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {!item && <MetadataLookupSection onAutoFill={handleFormChange} />}

          <form id="item-form" onSubmit={handleSubmit}>
            <ItemFormFields
              formData={formData}
              onChange={handleFormChange}
              locations={locations}
            />
          </form>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("library.itemDialog.cancel")}
          </Button>
          <Button
            type="submit"
            form="item-form"
            size="sm"
            disabled={isSubmitting || !formData.title.trim()}
          >
            {isSubmitting ? "..." : t("library.itemDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
