'use client';

import { useState } from 'react';
import { isApiError, useTranslation } from '@alfheim/shared';
import { DEFAULT_LAUNCHER_ICON } from '../icons';
import { LAUNCHER_PRESETS } from '../presets';
import { useCreateLauncher, useUpdateLauncher } from '../hooks/useLaunchers';
import type { Launcher } from '../types';
import { LauncherFormFields, type LauncherFormValues } from './LauncherFormFields';

interface LauncherFormProps {
  /** The launcher to edit; omitted to add a new one. */
  launcher?: Launcher;
  onDone: () => void;
}

function initialValues(launcher?: Launcher): LauncherFormValues {
  if (launcher) {
    return { preset: 'custom', title: launcher.title, url: launcher.url, icon: launcher.icon, description: launcher.description };
  }
  return { preset: 'custom', title: '', url: '', icon: DEFAULT_LAUNCHER_ICON, description: '' };
}

function errorKey(error: unknown): string {
  if (isApiError(error) && (error.status === 422 || error.status === 400)) return 'dashboard.launchers.error_invalid';
  if (isApiError(error) && error.status === 403) return 'dashboard.launchers.error_forbidden';
  return 'dashboard.launchers.error_failed';
}

/** Admin form that adds or edits a household launcher. Rendered only for OWNER and ADMIN. */
export function LauncherForm({ launcher, onDone }: LauncherFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<LauncherFormValues>(() => initialValues(launcher));
  const [error, setError] = useState<string | null>(null);
  const createLauncher = useCreateLauncher();
  const updateLauncher = useUpdateLauncher();
  const isSaving = createLauncher.isPending || updateLauncher.isPending;

  const applyPreset = (presetId: string) => {
    const preset = LAUNCHER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setValues((v) => ({ ...v, preset: preset.id, icon: preset.icon, title: preset.prefillTitle ? t(preset.labelKey) : v.title }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = {
      title: values.title.trim(),
      url: values.url.trim(),
      icon: values.icon,
      description: values.description.trim(),
      display_order: launcher?.display_order ?? 0,
    };
    const callbacks = { onSuccess: onDone, onError: (err: unknown) => setError(t(errorKey(err))) };
    if (launcher) {
      updateLauncher.mutate({ id: launcher.id, input }, callbacks);
    } else {
      createLauncher.mutate(input, callbacks);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={t(launcher ? 'dashboard.launchers.form_edit_title' : 'dashboard.launchers.form_add_title')}
      className="col-span-full p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-accent)] shadow-lg space-y-4"
    >
      <h3 className="text-sm font-bold text-[var(--text-main)]">
        {t(launcher ? 'dashboard.launchers.form_edit_title' : 'dashboard.launchers.form_add_title')}
      </h3>
      <LauncherFormFields
        values={values}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        onPreset={applyPreset}
        showPreset={!launcher}
      />
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]"
        >
          {t('dashboard.launchers.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[var(--primary-main)] text-black disabled:opacity-50"
        >
          {t('dashboard.launchers.save')}
        </button>
      </div>
    </form>
  );
}
