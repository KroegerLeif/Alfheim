"use client";

import * as React from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { describeApiError } from "@/core/apiError";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { CategoryRead } from "../types";
import { useDeleteCategory, useUpdateCategory } from "../services/categoryService";

interface CategoryRowProps {
  category: CategoryRead;
}

const ICON_BUTTON =
  "p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--primary-main)] bg-[var(--surface-canvas)] transition-colors cursor-pointer shrink-0 flex items-center";

/**
 * CategoryRow
 * One category. Custom categories can be renamed inline and deleted; global categories are
 * read-only on the server and only show a badge.
 */
export function CategoryRow({ category }: CategoryRowProps) {
  const { t } = useTranslation();
  const updateCategoryMut = useUpdateCategory();
  const deleteCategoryMut = useDeleteCategory();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [name, setName] = React.useState(category.name);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const startEditing = () => { setName(category.name); setErrorMessage(null); setIsEditing(true); };

  const save = () => {
    if (!name.trim() || updateCategoryMut.isPending) return;
    setErrorMessage(null);
    updateCategoryMut.mutate(
      { id: category.id, payload: { name: name.trim() } },
      {
        onSuccess: () => setIsEditing(false),
        // The edited name stays in the field so the user can fix a clash and save again.
        onError: async (error) => setErrorMessage(await describeApiError(error, t, "pantry.errors.updateCategoryFailed")),
      }
    );
  };

  return (
    <li className="border border-[var(--border-subtle)] bg-[var(--surface-canvas)] rounded p-2 space-y-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {isEditing ? (
          <>
            <input type="text" value={name} autoFocus maxLength={100} aria-label={t("pantry.categoryName")}
              onChange={(e) => { setName(e.target.value); setErrorMessage(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setIsEditing(false); }}
              className="flex-1 min-w-0 p-1.5 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-xs text-[var(--text-main)] font-mono rounded" />
            <Button type="button" size="sm" onClick={save} disabled={updateCategoryMut.isPending || !name.trim()}
              aria-label={t("common.save")} className="px-2 shrink-0">
              {updateCategoryMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(false)}
              aria-label={t("common.cancel")} className="px-2 shrink-0">
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1 min-w-0 truncate text-xs font-bold uppercase" title={category.name}>{category.name}</span>
            {category.is_global ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 uppercase rounded bg-[var(--primary-main)] text-black shrink-0">{t("pantry.global")}</span>
            ) : (
              <>
                <button type="button" onClick={startEditing} className={ICON_BUTTON}
                  aria-label={`${t("pantry.edit.category")}: ${category.name}`} title={t("pantry.edit.category")}>
                  <Pencil className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => setIsDeleting(true)} className={`${ICON_BUTTON} hover:text-red-400`}
                  aria-label={`${t("pantry.delete.category")}: ${category.name}`} title={t("pantry.delete.category")}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
          </>
        )}
      </div>
      {errorMessage && <ErrorBanner message={errorMessage} />}
      <DeleteConfirmDialog
        open={isDeleting}
        onClose={() => setIsDeleting(false)}
        title={t("pantry.delete.categoryTitle")}
        question={t("pantry.delete.categoryQuestion")}
        name={category.name}
        onConfirm={() => deleteCategoryMut.mutateAsync(category.id)}
        failureKey="pantry.errors.deleteCategoryFailed"
        codeKeys={{ category_in_use: "pantry.errors.categoryInUse" }}
      />
    </li>
  );
}
