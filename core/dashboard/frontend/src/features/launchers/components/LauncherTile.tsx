'use client';

import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import { launcherIcon } from '../icons';
import { safeHref } from '../safeHref';
import type { Launcher } from '../types';

interface LauncherTileProps {
  launcher: Launcher;
  canManage: boolean;
  onEdit: (launcher: Launcher) => void;
  onDelete: (launcher: Launcher) => void;
  isDeleting?: boolean;
}

/** One household launcher: opens the target in a new tab, never in a frame. */
export function LauncherTile({ launcher, canManage, onEdit, onDelete, isDeleting = false }: LauncherTileProps) {
  const { t } = useTranslation();
  const Icon = launcherIcon(launcher.icon);
  const href = safeHref(launcher.url);

  return (
    <div className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between shadow-lg min-w-0">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-main)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          {canManage && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(launcher)}
                aria-label={t('dashboard.launchers.edit', { title: launcher.title })}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-elevated)]"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(launcher)}
                disabled={isDeleting}
                aria-label={t('dashboard.launchers.delete', { title: launcher.title })}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--surface-elevated)] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <h3 className="text-base font-bold text-[var(--text-main)] truncate" title={launcher.title}>
          {launcher.title}
        </h3>
        {launcher.description && (
          <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed break-words">
            {launcher.description}
          </p>
        )}
      </div>

      <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <span className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider">
          {t('dashboard.launchers.tag')}
        </span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('dashboard.launchers.open', { title: launcher.title })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
          >
            <span>{t('common.open_portal')}</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
