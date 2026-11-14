'use client';

import { useTranslation } from '@alfheim/shared';
import { AppHealthState, AppItem } from '@/shared/types';
import Link from 'next/link';
import { CoreAppCard } from './CoreAppCard';

interface CoreAppsSectionProps {
  isLoading: boolean;
  isError: boolean;
  apps?: AppItem[];
  refetch: () => void;
  /** Live health per app ID from GET /api/v1/apps/health; missing while the first probe runs. */
  health?: Record<string, AppHealthState>;
}

export function CoreAppsSection({ isLoading, isError, apps, refetch, health }: CoreAppsSectionProps) {
  const { t } = useTranslation();
  // Disabled apps are absent from the registry, so the list may be empty.
  const items = apps ?? [];

  return (
    <div className="col-span-12 mt-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--primary-main)]">apps</span>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <span>{t('dashboard.tier1_title')}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal uppercase">
                {t('dashboard.tier1_badge')}
              </span>
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {t('dashboard.tier1_active_count', { count: items.length })}
          </span>
          <Link
            href="/settings"
            className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] font-mono text-xs flex items-center gap-1.5 transition-all duration-150"
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            <span>{t('dashboard.tier1_manage_visibility')}</span>
          </Link>
          <button
            onClick={() => refetch()}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-150"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>{t('common.sync')}</span>
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
          <div className="col-span-full p-6 rounded-xl bg-red-950/20 border border-red-800/40 text-red-300 text-xs font-mono">
            {t('dashboard.tier1_load_error')}
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full p-8 rounded-xl bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-center space-y-3 flex flex-col items-center justify-center min-h-[140px] shadow-lg">
            <span className="material-symbols-outlined text-3xl text-[var(--text-muted)]">visibility_off</span>
            <p className="text-xs font-mono text-[var(--text-muted)]">
              {t('dashboard.tier1_empty_hidden')}
            </p>
            <Link
              href="/settings"
              className="px-3 py-1 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--primary-main)] font-mono text-xs font-bold transition-colors"
            >
              {t('dashboard.tier1_configure_settings')}
            </Link>
          </div>
        ) : (
          items.map((app) => <CoreAppCard key={app.id} app={app} health={health?.[app.id]} />)
        )}
      </div>
    </div>
  );
}
