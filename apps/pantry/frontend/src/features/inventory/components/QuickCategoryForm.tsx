"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useCreateCategory } from "@/features/categories/services/categoryService";

interface QuickCategoryFormProps {
  onCreated: (id: string) => void;
  onCancel: () => void;
}

/**
 * QuickCategoryForm
 * Inline form to create a new category from within the StockActionModal product creation step.
 */
export function QuickCategoryForm({ onCreated, onCancel }: QuickCategoryFormProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const createCategoryMut = useCreateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createCategoryMut.mutate(
      { name: name.trim() },
      { onSuccess: (cat) => onCreated(cat.id) }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
        placeholder={t("pantry.categoryPlaceholder")}
        className="flex-1 p-2 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-xs text-[var(--text-main)] font-mono rounded" />
      <Button type="submit" disabled={createCategoryMut.isPending || !name.trim()}
        className="text-xs px-3 bg-[var(--primary-main)] text-black font-bold uppercase">
        {createCategoryMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.save")}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onCancel} className="text-xs">✕</Button>
    </form>
  );
}
