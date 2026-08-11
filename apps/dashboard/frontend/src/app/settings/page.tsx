'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme, useTranslation } from '@alfheim/shared';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  swatches: string[];
}

function ColorPicker({ label, value, onChange, swatches }: ColorPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleHexChange = (val: string) => {
    setInputValue(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className="space-y-2.5">
      <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">{label}</label>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2.5 items-center">
          <div 
            onClick={() => inputRef.current?.click()}
            className="w-10 h-10 border border-[var(--border-subtle)] rounded-xl cursor-pointer hover:scale-105 hover:shadow-md transition-all shrink-0 relative overflow-hidden"
            style={{ backgroundColor: value }}
            title="Click to open color picker palette"
          >
            <input
              ref={inputRef}
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleHexChange(e.target.value)}
            placeholder="#3eb1ff"
            className="flex-1 max-w-[140px] px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-xl text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              onClick={() => {
                onChange(swatch);
                setInputValue(swatch);
              }}
              className={`w-6 h-6 rounded-lg border transition-all hover:scale-110 cursor-pointer ${
                value.toLowerCase() === swatch.toLowerCase()
                  ? 'border-[var(--primary-main)] scale-105 shadow-[0_0_8px_var(--accent-glow)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]'
              }`}
              style={{ backgroundColor: swatch }}
              title={swatch}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface CustomPreset {
  id: string;
  name: string;
  colors: any;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { variant, setVariant, resolvedMode, customColors, setCustomColors } = useTheme();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [presets, setPresets] = useState<CustomPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetError, setPresetError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('alfheim_custom_presets');
        if (saved) {
          setPresets(JSON.parse(saved));
        } else {
          const defaults: CustomPreset[] = [
            {
              id: 'preset-cyberpunk',
              name: 'Neon Cyberpunk',
              colors: {
                dark: { primary: '#ec4899', canvas: '#090d16', accent: '#00f0ff' },
                light: { primary: '#ec4899', canvas: '#fff0f6', accent: '#00f0ff' }
              }
            },
            {
              id: 'preset-minty',
              name: 'Minty Fresh',
              colors: {
                dark: { primary: '#10b981', canvas: '#061c15', accent: '#10b981' },
                light: { primary: '#059669', canvas: '#f0fdf4', accent: '#059669' }
              }
            }
          ];
          setPresets(defaults);
          localStorage.setItem('alfheim_custom_presets', JSON.stringify(defaults));
        }
      } catch {}
    }
  }, []);

  const handleSaveSettings = () => {
    setStatusMessage(t('common.save_changes'));
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      setPresetError('Preset name cannot be empty');
      return;
    }
    if (!customColors) return;

    const newPreset: CustomPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      colors: JSON.parse(JSON.stringify(customColors))
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('alfheim_custom_presets', JSON.stringify(updated));
    setNewPresetName('');
    setPresetError(null);
  };

  const handleDeletePreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('alfheim_custom_presets', JSON.stringify(updated));
  };

  const handleApplyPreset = (preset: CustomPreset) => {
    setCustomColors(preset.colors);
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
        <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-6">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-main)] font-mono flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[var(--primary-main)]">palette</span>
              Custom Theme Builder ({resolvedMode} Mode)
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Adjust the primary accent, background canvas, and glow/border highlights below. Colors are automatically saved and applied live.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6">
            <ColorPicker
              label="Primary Accent"
              value={customColors[resolvedMode]?.primary || '#3eb1ff'}
              onChange={(val) => handleColorChange('primary', val)}
              swatches={['#ec4899', '#3eb1ff', '#00f0ff', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#f43f5e']}
            />
            <ColorPicker
              label="Background Canvas"
              value={customColors[resolvedMode]?.canvas || (resolvedMode === 'dark' ? '#0b1326' : '#f4f6fb')}
              onChange={(val) => handleColorChange('canvas', val)}
              swatches={
                resolvedMode === 'dark'
                  ? ['#0b1326', '#090d16', '#0f172a', '#18181b', '#1a1a1a', '#020202']
                  : ['#f4f6fb', '#ffffff', '#f8fafc', '#f4f4f5', '#fafafa', '#f1f5f9']
              }
            />
            <ColorPicker
              label="Accent Glow & Border"
              value={customColors[resolvedMode]?.accent || '#3eb1ff'}
              onChange={(val) => handleColorChange('accent', val)}
              swatches={['#ec4899', '#3eb1ff', '#00f0ff', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#f43f5e']}
            />
          </div>

          {/* Saved Custom Presets List */}
          <div className="pt-6 border-t border-[var(--border-subtle)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                  Saved Color Presets
                </h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Save your active custom colors config as a reusable preset, or apply saved presets.
                </p>
              </div>
              
              <div className="flex gap-2 max-w-sm">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => {
                    setNewPresetName(e.target.value);
                    if (presetError) setPresetError(null);
                  }}
                  placeholder="Preset Name (e.g. Neon Cyberpunk)"
                  className="px-3 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-sans text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] transition-colors placeholder:text-[var(--text-faint)]"
                />
                <button
                  onClick={handleSavePreset}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-main)] font-semibold text-xs hover:border-[var(--primary-main)] transition-all cursor-pointer whitespace-nowrap"
                >
                  Save Active
                </button>
              </div>
            </div>

            {presetError && (
              <p className="text-[10px] font-mono text-rose-400">{presetError}</p>
            )}

            {presets.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] font-mono italic">
                No saved custom presets yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {presets.map((preset) => {
                  const isActive = customColors && 
                    customColors[resolvedMode]?.primary === preset.colors[resolvedMode]?.primary &&
                    customColors[resolvedMode]?.canvas === preset.colors[resolvedMode]?.canvas &&
                    customColors[resolvedMode]?.accent === preset.colors[resolvedMode]?.accent;

                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'bg-[var(--surface-canvas)] border-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]'
                          : 'bg-[var(--surface-canvas)] border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold font-mono text-[var(--text-main)] truncate" title={preset.name}>
                          {preset.name}
                        </span>
                        <button
                          onClick={(e) => handleDeletePreset(preset.id, e)}
                          className="text-[var(--text-muted)] hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer shrink-0"
                          title="Delete Preset"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>

                      <div className="h-6 rounded-lg border border-[var(--border-subtle)] p-1 flex items-center gap-1.5" style={{ backgroundColor: preset.colors[resolvedMode]?.canvas }}>
                        <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: preset.colors[resolvedMode]?.primary }} />
                        <div className="w-3 h-3 rounded-full border border-black/20" style={{ backgroundColor: preset.colors[resolvedMode]?.accent }} />
                        <span className="text-[9px] font-mono text-[var(--text-muted)] ml-auto">
                          {preset.colors[resolvedMode]?.primary}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

