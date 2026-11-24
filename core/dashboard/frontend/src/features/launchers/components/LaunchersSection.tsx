'use client';

import { useState } from 'react';
import { AppWindow, Plus } from 'lucide-react';
import { useActiveHousehold, useTranslation } from '@alfheim/shared';
import { useCanManageLaunchers, useDeleteLauncher, useLaunchers } from '../hooks/useLaunchers';
import type { Launcher } from '../types';
import { LauncherForm } from './LauncherForm';
import { LauncherTile } from './LauncherTile';

/** `null`: no form; `'new'`: add form; a launcher: edit form for it. */
type FormState = null | 'new' | Launcher;

/**
 * Household launchers: links to the household's other web apps, managed by its owners and
 * admins and shown to every member. Sits between the Tier-1 apps and the operator stack apps.
 */
export function LaunchersSection() {
  const { t } = useTranslation();
  const { status } = useActiveHousehold();
  const { data, isLoading, isError } = useLaunchers();
  const canManage = useCanManageLaunchers();
  const deleteLauncher = useDeleteLauncher();
  const [form, setForm] = useState<FormState>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const items = data ?? [];

  const handleDelete = (launcher: Launcher) => {
    setDeleteError(null);
    deleteLauncher.mutate(launcher.id, { onError: () => setDeleteError(t('dashboard.launchers.error_delete')) });
  };

  const notice = (text: string, tone: 'muted' | 'error' = 'muted') => (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={
        tone === 'error'
          ? 'col-span-full p-6 rounded-xl bg-red-950/20 border border-red-800/40 text-red-300 text-xs font-mono'
          : 'col-span-full p-8 rounded-xl bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-center text-xs font-mono text-[var(--text-muted)]'
      }
    >
      {text}
    </div>
  );

  let body: React.ReactNode;
  if (status !== 'ready' && status !== 'loading') {
    body = notice(t('dashboard.launchers.no_household'));
  } else if (status === 'loading' || isLoading) {
    body = Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-44 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse" />
    ));
  } else if (isError) {
    body = notice(t('dashboard.launchers.load_error'), 'error');
  } else if (items.length === 0 && form === null) {
    body = notice(t(canManage ? 'dashboard.launchers.empty_admin' : 'dashboard.launchers.empty'));
  } else {
    body = items.map((launcher) => (
      <LauncherTile
        key={launcher.id}
        launcher={launcher}
        canManage={canManage}
        onEdit={(l) => setForm(l)}
        onDelete={handleDelete}
        isDeleting={deleteLauncher.isPending && deleteLauncher.variables === launcher.id}
      />
    ));
  }

  return (
    <section className="col-span-12 mt-6" aria-labelledby="launchers-heading">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AppWindow className="h-5 w-5 text-[var(--primary-main)]" aria-hidden="true" />
          <h2 id="launchers-heading" className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
            <span>{t('dashboard.launchers.title')}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 font-normal uppercase">
              {t('dashboard.launchers.badge')}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {t('dashboard.launchers.count', { count: items.length })}
          </span>
          {canManage && form === null && (
            <button
              type="button"
              onClick={() => setForm('new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary-main)] text-black"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t('dashboard.launchers.add')}</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {canManage && form !== null && (
          <LauncherForm
            key={form === 'new' ? 'new' : form.id}
            launcher={form === 'new' ? undefined : form}
            onDone={() => setForm(null)}
          />
        )}
        {deleteError && notice(deleteError, 'error')}
        {body}
      </div>
    </section>
  );
}
