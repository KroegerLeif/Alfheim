'use client';

import { useState } from 'react';
import { useTheme, useTranslation } from '@loeger-os/shared';

/**
 * System Settings View component.
 * Features an interactive theme picker, network gateway configuration toggles,
 * and system health / update status cards.
 */
export default function SettingsPage() {
  const { t } = useTranslation();
  const { variant, setVariant } = useTheme();

  // Network configuration state toggles
  const [nginxGateway, setNginxGateway] = useState(true);
  const [keycloakSso, setKeycloakSso] = useState(true);
  const [telemetryStream, setTelemetryStream] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSaveSettings = () => {
    setStatusMessage(t('common.save_changes'));
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <>
      {/* Settings Header */}
      <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)] text-xs font-mono mb-2 border border-[var(--border-accent)]">
            <span className="material-symbols-outlined text-sm">settings_suggest</span>
            {t('nav.settings')}
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)]">
            {t('settings.title')}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {t('settings.subtitle')}
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="px-4 py-2.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-semibold text-xs hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-[0_0_15px_var(--accent-glow)] cursor-pointer"
        >
          {t('common.save_changes')}
        </button>
      </div>

      {statusMessage && (
        <div className="col-span-12 p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-mono">
          {statusMessage}
        </div>
      )}

      {/* Visual Theme Picker */}
      <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
          {t('settings.theme_title')}
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          {t('settings.theme_subtitle')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Obsidian Flux Theme Card */}
          <div
            onClick={() => setVariant('obsidian')}
            className={`p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              variant === 'obsidian'
                ? 'bg-[var(--surface-card)] border-[var(--primary-main)] shadow-[0_0_20px_var(--accent-glow)]'
                : 'bg-[var(--surface-canvas)] border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold font-mono text-[var(--text-main)]">Obsidian Flux</span>
                {variant === 'obsidian' && (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--primary-main)]/20 text-[var(--primary-main)] border border-[var(--primary-main)]/40 font-bold">
                    {t('common.active')}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                {t('settings.obsidian_desc')}
              </p>
            </div>

            <div className="h-10 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] p-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[var(--primary-main)]" />
              <div className="w-12 h-2 rounded bg-[var(--surface-elevated)]" />
              <div className="w-8 h-2 rounded bg-[var(--primary-main)]/30 ml-auto" />
            </div>
          </div>

          {/* Kinetic Minimalist Theme Card */}
          <div
            onClick={() => setVariant('kinetic')}
            className={`p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              variant === 'kinetic'
                ? 'bg-[var(--surface-card)] border-[var(--primary-main)] shadow-[0_0_20px_var(--accent-glow)]'
                : 'bg-[var(--surface-canvas)] border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold font-mono text-[var(--text-main)]">Kinetic Minimalist</span>
                {variant === 'kinetic' && (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--primary-main)]/20 text-[var(--primary-main)] border border-[var(--primary-main)]/40 font-bold">
                    {t('common.active')}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                {t('settings.kinetic_desc')}
              </p>
            </div>

            <div className="h-10 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] p-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[var(--primary-main)]" />
              <div className="w-12 h-2 rounded bg-[var(--surface-elevated)]" />
              <div className="w-8 h-2 rounded bg-[var(--primary-main)]/40 ml-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Network & Infrastructure Toggles */}
      <div className="col-span-12 md:col-span-8 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
          {t('settings.gateway_rules')}
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          {t('settings.gateway_subtitle')}
        </p>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">{t('settings.nginx_proxy')}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                {t('settings.nginx_proxy_desc')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNginxGateway(!nginxGateway)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 p-0.5 cursor-pointer ${
                nginxGateway ? 'bg-[var(--primary-main)]' : 'bg-[var(--surface-canvas)]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform duration-200 ${
                  nginxGateway ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">{t('settings.keycloak_sso')}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                {t('settings.keycloak_sso_desc')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setKeycloakSso(!keycloakSso)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 p-0.5 cursor-pointer ${
                keycloakSso ? 'bg-[var(--primary-main)]' : 'bg-[var(--surface-canvas)]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform duration-200 ${
                  keycloakSso ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">{t('settings.telemetry_stream')}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                {t('settings.telemetry_stream_desc')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTelemetryStream(!telemetryStream)}
              className={`w-11 h-6 rounded-full transition-colors duration-200 p-0.5 cursor-pointer ${
                telemetryStream ? 'bg-[var(--primary-main)]' : 'bg-[var(--surface-canvas)]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform duration-200 ${
                  telemetryStream ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
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
