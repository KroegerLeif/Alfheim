'use client';

import { useState } from 'react';
import { useTranslation } from '@alfheim/shared';
import { CustomPreset, CustomThemeColors } from './CustomThemeBuilder';

interface SavedThemePresetsProps {
  presets: CustomPreset[];
  customColors: CustomThemeColors;
  resolvedMode: 'dark' | 'light';
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  onApplyPreset: (preset: CustomPreset) => void;
  presetError: string | null;
  setPresetError: (err: string | null) => void;
}

export function SavedThemePresets({
  presets,
  customColors,
  resolvedMode,
  onSavePreset,
  onDeletePreset,
  onApplyPreset,
  presetError,
  setPresetError,
}: SavedThemePresetsProps) {
  const { t } = useTranslation();
  const [newPresetName, setNewPresetName] = useState('');

  const handleSave = () => {
    onSavePreset(newPresetName);
    setNewPresetName('');
  };

  return (
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
            onClick={handleSave}
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
                onClick={() => onApplyPreset(preset)}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePreset(preset.id);
                    }}
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
  );
}
