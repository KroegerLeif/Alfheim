'use client';

import { useTranslation } from '@alfheim/shared';
import { LAUNCHER_ICON_NAMES } from '../icons';
import { LauncherIcon } from './LauncherIcon';
import { LAUNCHER_PRESETS } from '../presets';

export interface LauncherFormValues {
  preset: string;
  title: string;
  url: string;
  icon: string;
  description: string;
}

interface LauncherFormFieldsProps {
  values: LauncherFormValues;
  onChange: (patch: Partial<LauncherFormValues>) => void;
  onPreset: (presetId: string) => void;
  showPreset: boolean;
}

const inputClass =
  'w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)] transition-colors';
const labelClass = 'block text-xs font-mono uppercase text-[var(--text-muted)] mb-1';

/** Inputs of the launcher admin form; the parent owns the state. */
export function LauncherFormFields({ values, onChange, onPreset, showPreset }: LauncherFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {showPreset && (
        <div>
          <label htmlFor="launcher-preset" className={labelClass}>{t('dashboard.launchers.field_preset')}</label>
          <select id="launcher-preset" value={values.preset} onChange={(e) => onPreset(e.target.value)} className={inputClass}>
            {LAUNCHER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{t(preset.labelKey)}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="launcher-title" className={labelClass}>{t('dashboard.launchers.field_title')}</label>
        <input
          id="launcher-title"
          type="text"
          value={values.title}
          maxLength={100}
          required
          onChange={(e) => onChange({ title: e.target.value })}
          className={inputClass}
        />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="launcher-url" className={labelClass}>{t('dashboard.launchers.field_url')}</label>
        <input
          id="launcher-url"
          type="url"
          inputMode="url"
          value={values.url}
          maxLength={2048}
          required
          placeholder="https://"
          aria-describedby="launcher-url-hint"
          onChange={(e) => onChange({ url: e.target.value })}
          className={`${inputClass} font-mono`}
        />
        <p id="launcher-url-hint" className="mt-1 text-[11px] text-[var(--text-muted)]">
          {t('dashboard.launchers.url_hint')}
        </p>
      </div>
      <div>
        <label htmlFor="launcher-icon" className={labelClass}>{t('dashboard.launchers.field_icon')}</label>
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-main)]">
            <LauncherIcon name={values.icon} className="h-4 w-4" />
          </span>
          <select id="launcher-icon" value={values.icon} onChange={(e) => onChange({ icon: e.target.value })} className={inputClass}>
            {LAUNCHER_ICON_NAMES.map((name) => (
              <option key={name} value={name}>{t(`dashboard.launchers.icons.${name}`)}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="launcher-description" className={labelClass}>{t('dashboard.launchers.field_description')}</label>
        <input
          id="launcher-description"
          type="text"
          value={values.description}
          maxLength={500}
          onChange={(e) => onChange({ description: e.target.value })}
          className={inputClass}
        />
      </div>
    </div>
  );
}
