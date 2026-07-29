'use client';

import React from 'react';

export interface SidePanelProps {
  title?: string;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function SidePanel({
  title,
  isOpen,
  onClose,
  className = '',
  children,
}: SidePanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className={`fixed inset-y-0 right-0 z-40 w-full max-w-md bg-[var(--surface-card)] border-l border-[var(--border-subtle)] shadow-2xl ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--text-main)]">{title}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs"
          >
            ✕
          </button>
        )}
      </div>
      <div className="h-[calc(100%-53px)] overflow-y-auto">{children}</div>
    </aside>
  );
}
