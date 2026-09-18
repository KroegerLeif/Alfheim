'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@alfheim/shared';
import { useTranslation } from '@/i18n';
import { ContactCategory } from '@/shared/types';

interface CategoryModalProps {
  isOpen: boolean;
  editingCategory: ContactCategory | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; icon: string; color: string }) => void;
}

/**
 * Modal dialog for contact category creation and editing.
 */
export function CategoryModal({
  isOpen,
  editingCategory,
  onClose,
  onSubmit,
}: CategoryModalProps) {
  const { t } = useTranslation();

  // Form state is seeded from props; the parent remounts this modal (via
  // `key`) whenever it opens or the edited category changes.
  const [categoryName, setCategoryName] = useState(editingCategory?.name ?? '');
  const [categoryIcon, setCategoryIcon] = useState(editingCategory?.icon || 'person');
  const [categoryColor, setCategoryColor] = useState(editingCategory?.color || '#2563eb');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    onSubmit({
      name: categoryName.trim(),
      icon: categoryIcon,
      color: categoryColor,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="text-base font-bold text-[var(--text-main)]">
          {editingCategory ? t('household.edit_category') : t('household.add_category')}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="category-name" className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              {t('household.name')} *
            </label>
            <input
              id="category-name"
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder={t('household.category_name_placeholder')}
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category-icon" className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                {t('household.icon_symbol')}
              </label>
              <input
                id="category-icon"
                type="text"
                value={categoryIcon}
                onChange={(e) => setCategoryIcon(e.target.value)}
                placeholder={t('household.category_icon_placeholder')}
                className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
              />
            </div>
            <div>
              <label htmlFor="category-color" className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                {t('household.color_indicator')}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  id="category-color"
                  type="color"
                  value={categoryColor}
                  onChange={(e) => setCategoryColor(e.target.value)}
                  className="w-10 h-8 rounded border border-[var(--border-subtle)] bg-transparent cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
                />
                <input
                  id="category-color-text"
                  type="text"
                  value={categoryColor}
                  onChange={(e) => setCategoryColor(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded text-xs font-mono text-[var(--text-main)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer"
            >
              {editingCategory ? t('household.edit_category') : t('household.add_category')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
