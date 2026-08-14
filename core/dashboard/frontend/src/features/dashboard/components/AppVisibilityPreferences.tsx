'use client';

import { useTranslation } from '@alfheim/shared';
import { AppItem } from '@/shared/types';

interface AppVisibilityPreferencesProps {
  allCoreApps: AppItem[];
  hiddenAppIds: string[];
  onToggleCoreApp: (appId: string) => void;
}

export function AppVisibilityPreferences({
  allCoreApps,
  hiddenAppIds,
  onToggleCoreApp,
}: AppVisibilityPreferencesProps) {
  const { t } = useTranslation();

  return (
    <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--primary-main)]">visibility</span>
          <span>{t('settings.visibility_title')}</span>
        </h2>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-5">
        {t('settings.visibility_desc')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allCoreApps.map((app) => {
          const isHidden = hiddenAppIds.includes(app.id) || hiddenAppIds.includes(app.slug);
          return (
            <div
              key={app.id}
              onClick={() => onToggleCoreApp(app.id)}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                !isHidden
                  ? 'bg-[var(--surface-canvas)] border-[var(--primary-main)]/50 shadow-sm'
                  : 'bg-[var(--surface-card)] border-[var(--border-subtle)] opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  !isHidden ? 'bg-[var(--primary-main)]/10 text-[var(--primary-main)]' : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'
                }`}>
                  <span className="material-symbols-outlined text-lg">{app.icon || 'grid_view'}</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-main)]">{app.title || app.name}</div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                    {!isHidden ? t('settings.visible_state') : t('settings.hidden_state')}
                  </div>
                </div>
              </div>

              <div className={`w-10 h-6 rounded-full transition-colors p-1 flex items-center ${
                !isHidden ? 'bg-[var(--primary-main)] justify-end' : 'bg-slate-700 justify-start'
              }`}>
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
