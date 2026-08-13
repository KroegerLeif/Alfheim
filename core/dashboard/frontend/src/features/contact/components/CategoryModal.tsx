'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@alfheim/shared';
import { ContactCategory } from '@/shared/types';

interface CategoryModalProps {
  editingCategory: ContactCategory | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; icon: string; color: string }) => void;
}

/**
 * Modal dialog for contact category creation and editing.
 */
export function CategoryModal({
  editingCategory,
  onClose,
  onSubmit,
}: CategoryModalProps) {
  const { t } = useTranslation();

  const [categoryName, setCategoryName] = useState('');
  const [categoryIcon, setCategoryIcon] = useState('person');
  const [categoryColor, setCategoryColor] = useState('#2563eb');

  useEffect(() => {
    if (editingCategory) {
      setCategoryName(editingCategory.name);
      setCategoryIcon(editingCategory.icon || 'person');
      setCategoryColor(editingCategory.color || '#2563eb');
    } else {
      setCategoryName('');
      setCategoryIcon('person');
      setCategoryColor('#2563eb');
    }
  }, [editingCategory]);

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
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-base font-bold text-[var(--text-main)]">
            {editingCategory ? t('household.edit_category') : t('household.add_category')}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              {t('household.name')} *
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Health, Utilities"
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                Icon (Material symbol)
              </label>
              <input
                type="text"
                value={categoryIcon}
                onChange={(e) => setCategoryIcon(e.target.value)}
                placeholder="e.g. home, call, local_hospital"
                className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                Color Indicator
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={categoryColor}
                  onChange={(e) => setCategoryColor(e.target.value)}
                  className="w-10 h-8 rounded border border-[var(--border-subtle)] bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={categoryColor}
                  onChange={(e) => setCategoryColor(e.target.value)}
                  className="w-full px-2 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded text-xs font-mono text-[var(--text-main)] focus:outline-none"
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
      </div>
    </div>
  );
}
