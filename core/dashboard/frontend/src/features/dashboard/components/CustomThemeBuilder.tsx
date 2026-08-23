'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@alfheim/shared';
import { ColorPicker } from './ColorPicker';
import { SavedThemePresets } from './SavedThemePresets';

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

  const handleSavePreset = (name: string) => {
    if (!name.trim()) {
      setPresetError(t('settings.preset_name_required'));
      return;
    }
    if (!customColors) return;

    const newPreset: CustomPreset = {
      id: `preset-${Date.now()}`,
      name: name.trim(),
      colors: JSON.parse(JSON.stringify(customColors))
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('alfheim_custom_presets', JSON.stringify(updated));
    setPresetError(null);
  };

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('alfheim_custom_presets', JSON.stringify(updated));
  };

  const handleColorChange = (key: 'primary' | 'canvas' | 'accent', value: string) => {
    if (!customColors) return;
    setCustomColors({
      ...customColors,
      [resolvedMode]: {
        ...customColors[resolvedMode],
        [key]: value
      }
    });
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

      <SavedThemePresets
        presets={presets}
        customColors={customColors}
        resolvedMode={resolvedMode}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onApplyPreset={(preset) => setCustomColors(preset.colors)}
        presetError={presetError}
        setPresetError={setPresetError}
      />
    </div>
  );
}
