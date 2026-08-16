'use client';

import { useTranslation } from '@alfheim/shared';
import { AppItem } from '@/shared/types';
import Link from 'next/link';

interface UserAppsSectionProps {
  isLoading: boolean;
  isError: boolean;
  apps?: AppItem[];
  onOpenAddModal: () => void;
  onOpenEditModal: (app: AppItem) => void;
}

export function UserAppsSection({
  isLoading,
  isError,
  apps,
  onOpenAddModal,
  onOpenEditModal,
}: UserAppsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="col-span-12 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--primary-main)]">bookmark</span>
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>{t('dashboard.tier3_title')}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal uppercase">
              {t('dashboard.tier3_badge')}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {t('dashboard.tier3_count', { count: apps ? apps.length : 0 })}
          </span>
          <button
            onClick={onOpenAddModal}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold font-mono text-xs inline-flex items-center gap-1.5 cursor-pointer hover:bg-[var(--primary-hover)] transition-all duration-150 shadow-[0_0_12px_var(--accent-glow)]"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>{t('dashboard.tier3_add_bookmark')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse p-5 flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-lg bg-[var(--surface-elevated)]" />
              <div className="space-y-2">
                <div className="h-4 w-1/2 bg-[var(--surface-elevated)] rounded" />
                <div className="h-3 w-3/4 bg-[var(--surface-elevated)] rounded" />
              </div>
            </div>
          ))
        ) : isError ? (
          <div className="col-span-3 p-6 rounded-xl bg-red-950/20 border border-red-800/40 text-red-300 text-xs font-mono">
            {t('dashboard.tier3_load_error')}
          </div>
        ) : !apps || apps.length === 0 ? (
          <div className="col-span-3 p-8 rounded-xl bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-center space-y-3 flex flex-col items-center justify-center min-h-[140px] shadow-lg">
            <span className="material-symbols-outlined text-3xl text-[var(--text-muted)]">bookmark_border</span>
            <p className="text-xs font-mono text-[var(--text-muted)]">
              {t('dashboard.tier3_empty')}
            </p>
            <button
              onClick={onOpenAddModal}
              className="px-3 py-1 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--primary-main)] font-mono text-xs font-bold cursor-pointer transition-colors"
            >
              {t('dashboard.tier3_create_first')}
            </button>
          </div>
        ) : (
          apps.map((app) => {
            const targetUrl = app.url || app.app_url || '#';
            const isInternalRoute = targetUrl.startsWith('/');

            return (
              <div
                key={app.id}
                className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--primary-main)]">
                      <span className="material-symbols-outlined text-xl">
                        {app.icon || app.icon_url || 'link'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenEditModal(app)}
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--primary-main)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                      title={t('dashboard.tier3_edit_link')}
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                  </div>

                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    {app.title || app.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                    {app.description || t('dashboard.tier3_personal_bookmark')}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                    {t('dashboard.tier3_custom_link')}
                  </span>
                  {isInternalRoute ? (
                    <Link
                      href={targetUrl}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                    >
                      <span>{t('dashboard.tier3_open_link')}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  ) : (
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                    >
                      <span>{t('dashboard.tier3_open_link')}</span>
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
