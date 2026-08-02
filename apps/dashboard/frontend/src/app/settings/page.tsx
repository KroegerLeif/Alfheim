'use client';

import { useState } from 'react';
import { useTheme, useTranslation } from '@loeger-os/shared';

/**
 * System Settings View component.
 * Features an interactive theme picker, read-only gateway rules,
 * and system health / update status cards.
 */
export default function SettingsPage() {
  const { t } = useTranslation();
  const { variant, setVariant, resolvedMode, customColors, setCustomColors } = useTheme();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSaveSettings = () => {
    setStatusMessage(t('common.save_changes'));
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleColorChange = (key: 'primary' | 'canvas' | 'accent', value: string) => {
    if (!customColors) return;
    const updatedColors = {
      ...customColors,
      [resolvedMode]: {
        ...customColors[resolvedMode],
        [key]: value
      }
    };
    setCustomColors(updatedColors);
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

            <div className="h-10 rounded-lg bg-[#0b1326] border border-[var(--border-subtle)] p-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#3eb1ff]" />
              <div className="w-12 h-2 rounded bg-[#182542]" />
              <div className="w-8 h-2 rounded bg-[#3eb1ff]/30 ml-auto" />
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

            <div className="h-10 rounded-lg bg-[#000000] border border-[var(--border-subtle)] p-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#00f0ff]" />
              <div className="w-12 h-2 rounded bg-[#141414]" />
              <div className="w-8 h-2 rounded bg-[#00f0ff]/40 ml-auto" />
            </div>
          </div>

          {/* Slate Balanced Theme Card */}
          <div
            onClick={() => setVariant('slate')}
            className={`p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              variant === 'slate'
                ? 'bg-[var(--surface-card)] border-[var(--primary-main)] shadow-[0_0_20px_var(--accent-glow)]'
                : 'bg-[var(--surface-canvas)] border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold font-mono text-[var(--text-main)]">Slate Balanced</span>
                {variant === 'slate' && (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--primary-main)]/20 text-[var(--primary-main)] border border-[var(--primary-main)]/40 font-bold">
                    {t('common.active')}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                {t('settings.slate_desc')}
              </p>
            </div>

            <div className="h-10 rounded-lg bg-[#0f172a] border border-[var(--border-subtle)] p-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#818cf8]" />
              <div className="w-12 h-2 rounded bg-[#334155]" />
              <div className="w-8 h-2 rounded bg-[#818cf8]/40 ml-auto" />
            </div>
          </div>

          {/* Custom Theme Card */}
          <div
            onClick={() => setVariant('custom')}
            className={`p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
              variant === 'custom'
                ? 'bg-[var(--surface-card)] border-[var(--primary-main)] shadow-[0_0_20px_var(--accent-glow)]'
                : 'bg-[var(--surface-canvas)] border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold font-mono text-[var(--text-main)]">Custom Theme</span>
                {variant === 'custom' && (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--primary-main)]/20 text-[var(--primary-main)] border border-[var(--primary-main)]/40 font-bold">
                    {t('common.active')}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                {t('settings.custom_desc')}
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

      {/* Custom Theme Builder Form */}
      {variant === 'custom' && customColors && (
        <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-main)] font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[var(--primary-main)]">palette</span>
            Custom Theme Builder ({resolvedMode} Mode)
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Adjust the primary accent, background canvas, and glow/border highlights below. Colors are automatically saved and applied live.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Primary Accent Color */}
            <div className="space-y-2">
              <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase">Primary Accent</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customColors[resolvedMode]?.primary || '#3eb1ff'}
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="w-10 h-10 p-0 border border-[var(--border-subtle)] rounded cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={customColors[resolvedMode]?.primary || '#3eb1ff'}
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  placeholder="#3eb1ff"
                  className="flex-1 px-3 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                />
              </div>
            </div>

            {/* Background Canvas Color */}
            <div className="space-y-2">
              <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase">Background Canvas</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customColors[resolvedMode]?.canvas || '#0b1326'}
                  onChange={(e) => handleColorChange('canvas', e.target.value)}
                  className="w-10 h-10 p-0 border border-[var(--border-subtle)] rounded cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={customColors[resolvedMode]?.canvas || '#0b1326'}
                  onChange={(e) => handleColorChange('canvas', e.target.value)}
                  placeholder="#0b1326"
                  className="flex-1 px-3 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                />
              </div>
            </div>

            {/* Accent Glow/Border Color */}
            <div className="space-y-2">
              <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase">Accent Glow & Border</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customColors[resolvedMode]?.accent || '#3eb1ff'}
                  onChange={(e) => handleColorChange('accent', e.target.value)}
                  className="w-10 h-10 p-0 border border-[var(--border-subtle)] rounded cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={customColors[resolvedMode]?.accent || '#3eb1ff'}
                  onChange={(e) => handleColorChange('accent', e.target.value)}
                  placeholder="#3eb1ff"
                  className="flex-1 px-3 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Infrastructure Status Panel (Read Only) */}
      <div className="col-span-12 md:col-span-8 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
          Infrastructure Status
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-5">
          Read-only gateway routing mesh, service proxy rules, and security authentication indicators.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Traefik Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">Traefik Ingress Routing</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                Dynamic edge routing and HTTPS TLS termination.
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                ACTIVE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                PROTECTED
              </span>
            </div>
          </div>

          {/* Nginx Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">Nginx Gateway Proxy</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                Internal loopback routing proxy for port-mapping rules.
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                ACTIVE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                PROTECTED
              </span>
            </div>
          </div>

          {/* Keycloak Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-[var(--text-main)]">Keycloak OAuth2 / OIDC</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                Central OpenID Connect single sign-on realm validate.
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                ACTIVE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                PROTECTED
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

