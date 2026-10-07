'use client';

import { useTranslation } from '@/i18n';
import { ContactCategory } from '@/shared/types';

interface CategoryManagerProps {
  categories: ContactCategory[];
  isGuest: boolean;
  onEditCategory: (cat: ContactCategory) => void;
  onDeleteCategory: (catId: string) => void;
}

/**
 * CategoryManager component to display and manage existing contact categories.
 */
export function CategoryManager({
  categories,
  isGuest,
  onEditCategory,
  onDeleteCategory,
}: CategoryManagerProps) {
  const { t } = useTranslation();
  const categoryList = categories ?? [];

  if (categoryList.length === 0 || isGuest) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-[var(--border-subtle)] mb-2">
      {categoryList.map((cat) => (
        <div
          key={cat.id}
          className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded text-[10px] font-mono font-medium border cursor-default"
          style={{
            borderColor: `${cat.color}40`,
            backgroundColor: `${cat.color}15`,
            color: cat.color,
          }}
        >
          <span className="material-symbols-outlined text-[10px] shrink-0" aria-hidden="true">{cat.icon || 'folder'}</span>
          <span className="truncate max-w-[12rem]" title={cat.name}>{cat.name}</span>
          <button
            type="button"
            onClick={() => onEditCategory(cat)}
            aria-label={t('household_app.contacts.edit_category', { name: cat.name })}
            className="hover:opacity-75 cursor-pointer inline-flex items-center shrink-0"
          >
            <span className="material-symbols-outlined text-[10px]" aria-hidden="true">edit</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteCategory(cat.id)}
            aria-label={t('household_app.contacts.delete_category', { name: cat.name })}
            className="text-red-400 hover:text-red-300 cursor-pointer inline-flex items-center shrink-0"
          >
            <span className="material-symbols-outlined text-[10px]" aria-hidden="true">delete</span>
          </button>
        </div>
      ))}
    </div>
  );
}
