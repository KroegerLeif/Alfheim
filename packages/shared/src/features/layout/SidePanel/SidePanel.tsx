'use client';

import React from 'react';

export interface SidePanelProps {
  title?: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
  bodyClassName?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
}

export function SidePanel({
  title,
  isOpen,
  onClose,
  className = '',
  bodyClassName = 'h-[calc(100%-53px)] overflow-y-auto',
  header,
  children,
}: SidePanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className={`fixed inset-y-0 right-0 z-40 w-full max-w-md bg-[var(--surface-card)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col ${className}`}>
      {header !== undefined ? (
        header
      ) : (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
          <div className="text-sm font-semibold text-[var(--text-main)]">{title}</div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </aside>
  );
}
