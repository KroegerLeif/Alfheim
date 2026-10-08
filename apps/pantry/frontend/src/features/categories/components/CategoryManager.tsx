"use client";

import { useTranslation } from "@alfheim/shared";
import { useCategories } from "../services/categoryService";
import { CategoryCreateForm } from "./CategoryCreateForm";
import { CategoryRow } from "./CategoryRow";

/**
 * CategoryManager
 * Lists the categories visible to the household and lets users add, rename and delete custom ones.
 */
export function CategoryManager() {
  const { t } = useTranslation();
  const { data } = useCategories();
  const categories = data ?? [];

  return (
    <section className="p-8 pt-0">
      <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 space-y-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-heading font-black tracking-wide border-b border-[var(--border-subtle)] pb-3 text-[var(--text-main)]">
          {t("pantry.categoriesTitle")}
        </h2>
        <CategoryCreateForm />
        {categories.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">{t("pantry.noCategories")}</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {categories.map((category) => <CategoryRow key={category.id} category={category} />)}
          </ul>
        )}
      </div>
    </section>
  );
}
