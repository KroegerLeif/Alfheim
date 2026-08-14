'use client';

import { useTranslation } from '@alfheim/shared';

export function InfraStatusWidget() {
  const { t } = useTranslation();

  return (
    <>
      {/* Infrastructure Status Panel (Read Only) */}
      <div className="col-span-12 md:col-span-8 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
          {t('settings.infra_status')}
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          {t('settings.infra_desc')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Caddy Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">{t('settings.caddy_title')}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                {t('settings.caddy_desc')}
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                {t('settings.status_active')}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                {t('settings.status_protected')}
              </span>
            </div>
          </div>

          {/* Nginx Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">{t('settings.nginx_proxy')}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                {t('settings.nginx_proxy_desc')}
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                {t('settings.status_active')}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                {t('settings.status_protected')}
              </span>
            </div>
          </div>

          {/* Keycloak Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">{t('settings.keycloak_sso')}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                {t('settings.keycloak_sso_desc')}
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                {t('settings.status_active')}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                {t('settings.status_protected')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* System Information & Update Status */}
      <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
          {t('settings.system_update')}
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          {t('settings.platform_release')}
        </p>

        <div className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('settings.current_version')}</span>
            <span className="text-xs font-mono font-bold text-[var(--primary-main)]">v15.2.0</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('settings.build_target')}</span>
            <span className="text-xs font-mono text-[var(--text-main)]">Next.js 16+ App Router</span>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-2 text-emerald-400 text-xs font-mono">
            <span className="material-symbols-outlined text-sm">verified</span>
            <span>{t('settings.platform_up_to_date')}</span>
          </div>
        </div>
      </div>
    </>
  );
}
