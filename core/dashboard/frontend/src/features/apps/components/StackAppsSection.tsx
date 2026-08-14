'use client';

import { StatusBadge, useTranslation } from '@alfheim/shared';
import { AppItem } from '@/shared/types';
import Link from 'next/link';

interface StackAppsSectionProps {
  isLoading: boolean;
  isError: boolean;
  apps?: AppItem[];
}

export function StackAppsSection({ isLoading, isError, apps }: StackAppsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="col-span-12 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--primary-main)]">hub</span>
          <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>{t('dashboard.tier2_title')}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 font-normal uppercase">
              {t('dashboard.tier2_badge')}
            </span>
          </h2>
        </div>
        <span className="text-xs font-mono text-[var(--text-muted)]">
          {t('dashboard.tier2_count', { count: apps ? apps.length : 0 })}
        </span>
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
            {t('dashboard.tier2_load_error')}
          </div>
        ) : !apps || apps.length === 0 ? (
          <div className="col-span-3 p-8 rounded-xl bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-center space-y-3 flex flex-col items-center justify-center min-h-[140px] shadow-lg">
            <span className="material-symbols-outlined text-3xl text-[var(--text-muted)]">dns</span>
            <p className="text-xs font-mono text-[var(--text-muted)]">
              {t('dashboard.tier2_empty')}
            </p>
          </div>
        ) : (
          apps.map((app) => {
            const targetUrl = app.status === 'in_progress' || app.status === 'maintenance'
              ? `/under-construction?app=${encodeURIComponent(app.title || app.name || app.slug)}`
              : (app.url || app.app_url || '#');

            const isInternalRoute = targetUrl.startsWith('/');

            return (
              <div
                key={app.id}
                className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-main)]">
                      <span className="material-symbols-outlined text-xl">
                        {app.icon || app.icon_url || 'open_in_new'}
                      </span>
                    </div>
                    <StatusBadge status={app.status || 'active'} />
                  </div>

                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    {app.title || app.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                    {app.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                    {t('dashboard.tier2_tag')}
                  </span>
                  {isInternalRoute ? (
                    <Link
                      href={targetUrl}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                    >
                      <span>{t('common.open_portal')}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  ) : (
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                    >
                      <span>{t('common.open_portal')}</span>
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
