'use client';

import { useState, useEffect } from 'react';
import { useTheme, useTranslation } from '@alfheim/shared';
import { useDashboardApps, useUpdateUserPreferences } from '@/features/apps';
import { ThemePickerWidget } from '@/features/dashboard/components/ThemePickerWidget';
import { CustomThemeBuilder } from '@/features/dashboard/components/CustomThemeBuilder';
import { AppVisibilityPreferences } from '@/features/dashboard/components/AppVisibilityPreferences';
import { InfraStatusWidget } from '@/features/dashboard/components/InfraStatusWidget';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { variant, customColors, setCustomColors, resolvedMode } = useTheme();
  const { data: dashboard } = useDashboardApps();
  const updatePrefsMutation = useUpdateUserPreferences();

  const [hiddenAppIds, setHiddenAppIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (dashboard?.preferences?.hidden_app_ids) {
      setHiddenAppIds(dashboard.preferences.hidden_app_ids);
    }
  }, [dashboard]);

  const handleToggleCoreApp = (appId: string) => {
    const isCurrentlyHidden = hiddenAppIds.includes(appId);
    let updated: string[];
    if (isCurrentlyHidden) {
      updated = hiddenAppIds.filter((id) => id !== appId);
    } else {
      updated = [...hiddenAppIds, appId];
    }
    setHiddenAppIds(updated);
    updatePrefsMutation.mutate(updated, {
      onSuccess: () => {
        setStatusMessage(t('settings.visibility_updated'));
        setTimeout(() => setStatusMessage(null), 3000);
      },
    });
  };

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

      {/* Core App Visibility Preferences Card (Tier 1) */}
      <AppVisibilityPreferences
        allCoreApps={dashboard?.all_core || []}
        hiddenAppIds={hiddenAppIds}
        onToggleCoreApp={handleToggleCoreApp}
      />

      {/* Visual Theme Picker */}
      <ThemePickerWidget />

      {/* Custom Theme Builder Form */}
      {variant === 'custom' && customColors && (
        <CustomThemeBuilder
          customColors={customColors}
          setCustomColors={setCustomColors}
          resolvedMode={resolvedMode}
        />
      )}

      {/* Infrastructure Status Panel & System Info */}
      <InfraStatusWidget />
    </>
  );
}
