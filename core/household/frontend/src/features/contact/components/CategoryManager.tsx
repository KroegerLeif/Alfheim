'use client';

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
  const categoryList = categories ?? [];

  if (categoryList.length === 0 || isGuest) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-[var(--border-subtle)] mb-2">
      {categoryList.map((cat) => (
        <div
          key={cat.id}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium border cursor-default"
          style={{
            borderColor: `${cat.color}40`,
            backgroundColor: `${cat.color}15`,
            color: cat.color,
          }}
        >
          <span className="material-symbols-outlined text-[10px]">{cat.icon || 'folder'}</span>
          <span>{cat.name}</span>
          <button
            onClick={() => onEditCategory(cat)}
            className="hover:opacity-75 cursor-pointer inline-flex items-center"
          >
            <span className="material-symbols-outlined text-[10px]">edit</span>
          </button>
          <button
            onClick={() => onDeleteCategory(cat.id)}
            className="text-red-400 hover:text-red-300 cursor-pointer inline-flex items-center"
          >
            <span className="material-symbols-outlined text-[10px]">delete</span>
          </button>
        </div>
      ))}
    </div>
  );
}
