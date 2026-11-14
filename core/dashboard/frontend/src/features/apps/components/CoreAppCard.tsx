'use client';

import { StatusBadge, useTranslation } from '@alfheim/shared';
import { AppHealthState, AppItem } from '@/shared/types';
import { isDashboardRoute } from '@/shared/routes';
import { NavAnchor } from '@/shared/components/NavAnchor';
import { AppHealthBadge } from './AppHealthBadge';

interface CoreAppCardProps {
  app: AppItem;
  /** Live state of the app backend; undefined until the first probe answered. */
  health?: AppHealthState;
}

/** One Tier-1 tile: configured status, live health and the launch link. */
export function CoreAppCard({ app, health }: CoreAppCardProps) {
  const { t } = useTranslation();
  const targetUrl = app.status === 'in_progress' || app.status === 'maintenance'
    ? `/under-construction?app=${encodeURIComponent(app.title || app.name || app.slug)}`
    : (app.url || app.app_url || '#');

  return (
    <div className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg min-w-0">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] group-hover:scale-105 transition-transform duration-200">
            <span className="material-symbols-outlined text-xl">
              {app.icon || app.icon_url || 'grid_view'}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={app.status || 'active'} />
            <AppHealthBadge state={health} />
          </div>
        </div>

        <h3 className="text-base font-bold text-[var(--text-main)] group-hover:text-[var(--primary-main)] transition-colors duration-150 truncate" title={app.title || app.name}>
          {app.title || app.name}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed break-words">
          {app.description}
        </p>
      </div>

      <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
          {t('dashboard.tier1_tag')}
        </span>
        <NavAnchor
          href={targetUrl}
          external={!isDashboardRoute(targetUrl)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
        >
          <span>{t('common.launch')}</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </NavAnchor>
      </div>
    </div>
  );
}
