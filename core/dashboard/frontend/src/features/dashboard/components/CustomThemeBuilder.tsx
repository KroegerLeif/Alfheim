'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@alfheim/shared';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  swatches: string[];
}

export function ColorPicker({ label, value, onChange, swatches }: ColorPickerProps) {
  const { t } = useTranslation();
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
            title={t('common.select_icon')}
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export interface CustomColorPalette {
  primary: string;
  canvas: string;
  accent: string;
}

export interface CustomThemeColors {
  dark: CustomColorPalette;
  light: CustomColorPalette;
}

export interface CustomPreset {
  id: string;
  name: string;
  colors: CustomThemeColors;
}

interface CustomThemeBuilderProps {
  customColors: CustomThemeColors;
  setCustomColors: (colors: CustomThemeColors) => void;
  resolvedMode: 'dark' | 'light';
}

export function CustomThemeBuilder({ customColors, setCustomColors, resolvedMode }: CustomThemeBuilderProps) {
  const { t } = useTranslation();
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

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      setPresetError(t('settings.preset_name_required'));
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
    <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-6">
      <div>
        <h3 className="text-sm font-bold text-[var(--text-main)] font-mono flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-[var(--primary-main)]">palette</span>
          {t('settings.custom_builder_title', { mode: resolvedMode })}
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {t('settings.custom_builder_desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6">
        <ColorPicker
          label={t('settings.primary_accent')}
          value={customColors[resolvedMode]?.primary || '#3eb1ff'}
          onChange={(val) => handleColorChange('primary', val)}
          swatches={['#ec4899', '#3eb1ff', '#00f0ff', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#f43f5e']}
        />
        <ColorPicker
          label={t('settings.bg_canvas')}
          value={customColors[resolvedMode]?.canvas || (resolvedMode === 'dark' ? '#0b1326' : '#f4f6fb')}
          onChange={(val) => handleColorChange('canvas', val)}
          swatches={
            resolvedMode === 'dark'
              ? ['#0b1326', '#090d16', '#0f172a', '#18181b', '#1a1a1a', '#020202']
              : ['#f4f6fb', '#ffffff', '#f8fafc', '#f4f4f5', '#fafafa', '#f1f5f9']
          }
        />
        <ColorPicker
          label={t('settings.accent_glow_border')}
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
              {t('settings.saved_presets')}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              {t('settings.saved_presets_desc')}
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
              placeholder={t('settings.preset_placeholder')}
              className="px-3 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-sans text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] transition-colors placeholder:text-[var(--text-faint)]"
            />
            <button
              onClick={handleSavePreset}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-main)] font-semibold text-xs hover:border-[var(--primary-main)] transition-all cursor-pointer whitespace-nowrap"
            >
              {t('settings.save_active')}
            </button>
          </div>
        </div>

        {presetError && (
          <p className="text-[10px] font-mono text-rose-400">{presetError}</p>
        )}

        {presets.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] font-mono italic">
            {t('settings.no_presets')}
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
                      title={t('settings.delete_preset')}
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
  );
}
