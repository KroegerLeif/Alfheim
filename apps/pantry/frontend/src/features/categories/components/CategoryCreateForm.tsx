"use client";

import * as React from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { Loader2, X } from "lucide-react";
import { describeApiError } from "@/core/apiError";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { useCreateCategory } from "@/features/categories/services/categoryService";

interface CategoryCreateFormProps {
  /** Called with the id of the new category, for example to select it in a product form. */
  onCreated?: (id: string) => void;
  /** Hides the cancel button when the form is always visible. */
  onCancel?: () => void;
}

/**
 * CategoryCreateForm
 * Inline field to create a category. It is deliberately not a `<form>`: it is rendered inside the
 * product forms, and a nested form would also submit the surrounding product form.
 */
export function CategoryCreateForm({ onCreated, onCancel }: CategoryCreateFormProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const createCategoryMut = useCreateCategory();

  const submit = () => {
    if (!name.trim() || createCategoryMut.isPending) return;
    setErrorMessage(null);
    createCategoryMut.mutate(
      { name: name.trim() },
      {
        onSuccess: (category) => { setName(""); onCreated?.(category.id); },
        // The typed name stays in the field so the user can correct it and retry.
        onError: async (error) => setErrorMessage(await describeApiError(error, t, "pantry.errors.createCategoryFailed")),
      }
    );
  };

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex gap-2">
        <input type="text" value={name} aria-label={t("pantry.categoryName")}
          onChange={(e) => { setName(e.target.value); setErrorMessage(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={t("pantry.categoryPlaceholder")} maxLength={100}
          className="flex-1 min-w-0 p-2 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-xs text-[var(--text-main)] font-mono rounded" />
        <Button type="button" onClick={submit} disabled={createCategoryMut.isPending || !name.trim()}
          className="text-xs px-3 bg-[var(--primary-main)] text-black font-bold uppercase shrink-0">
          {createCategoryMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.save")}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} aria-label={t("pantry.cancel")} className="text-xs shrink-0">
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {errorMessage && <ErrorBanner message={errorMessage} />}
    </div>
  );
}
