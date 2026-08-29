'use client';

import React from 'react';
import { useTranslation } from '../../i18n';
import { AlfiAvatar } from './AlfiAvatar';
import { AlfiStatus, ChatWidgetContext } from './types';

export interface ChatWidgetHeaderProps {
  status: AlfiStatus;
  context?: ChatWidgetContext;
  onReset: () => void;
  onClose: () => void;
}

export function ChatWidgetHeader({
  status,
  context,
  onReset,
  onClose,
}: ChatWidgetHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
      <div className="flex items-center gap-3 min-w-0">
        <AlfiAvatar status={status} size="sm" />
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-wide text-[var(--text-main)]">
              ALFI
            </span>
            {context?.sourceApp && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--primary-main)] uppercase tracking-wider truncate">
                {context.sourceApp}
              </span>
            )}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] truncate">
            {t('Chat.widgetSubtitle')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          aria-label={t('Chat.newChat')}
          title={t('Chat.newChat')}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-canvas)] transition-colors text-xs cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label={t('Chat.close')}
          title={t('Chat.close')}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-canvas)] transition-colors text-xs cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
