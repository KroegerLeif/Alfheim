'use client';

import { useState, useEffect } from 'react';
import { StatusBadge, useTranslation } from '@alfheim/shared';
import { useDashboardApps, AddAppModal, EditAppModal } from '@/features/apps';
import { SystemHealthWidget } from '@/features/dashboard/components/SystemHealthWidget';
import { SystemShellLogs } from '@/features/dashboard/components/SystemShellLogs';
import { AppItem } from '@/shared/types';
import Link from 'next/link';

/**
 * Root Dashboard View.
 * Renders live telemetry stats, interactive terminal log shell, and 3-tier application management:
 * 1. Tier 1 (Core Apps): Pre-built platform modules.
 * 2. Tier 2 (Stack Apps): Server-level YAML defined integrations.
 * 3. Tier 3 (User Links): User-bound custom bookmarks with full CRUD capabilities.
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: dashboard, isLoading, isError, refetch } = useDashboardApps();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Trigger graceful error toast on API load failure
  useEffect(() => {
    if (isError) {
      setToastMessage(t('dashboard.error_load_catalog'));
    }
  }, [isError, t]);

  const openAddModal = () => {
    setIsAddModalOpen(true);
  };

  const openEditModal = (app: AppItem) => {
    setEditingApp(app);
    setIsEditModalOpen(true);
  };

  const handleSuccess = (appName: string) => {
    setToastMessage(t('dashboard.toast_bookmark_saved', { name: appName }));
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <>
      {/* Toast Success Notification */}
      {toastMessage && (
        <div className="col-span-12 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-2xl animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* System Health Telemetry Widget */}
      <SystemHealthWidget />

      {/* Live System Shell / Terminal Log Feed */}
      <SystemShellLogs />

      {/* TIER 1: CORE APPLICATIONS */}
      <div className="col-span-12 mt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-main)]">apps</span>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <span>{t('dashboard.tier1_title')}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 font-normal uppercase">
                  {t('dashboard.tier1_badge')}
                </span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {t('dashboard.tier1_active_count', { count: dashboard?.core ? dashboard.core.length : 0 })}
            </span>
            <Link
              href="/settings"
              className="px-3 py-1.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] font-mono text-xs flex items-center gap-1.5 transition-all duration-150"
            >
              <span className="material-symbols-outlined text-sm">visibility</span>
              <span>{t('dashboard.tier1_manage_visibility')}</span>
            </Link>
            <button
              onClick={() => refetch()}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-150"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>{t('common.sync')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse p-5 flex flex-col justify-between"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--surface-elevated)]" />
                <div className="space-y-2">
                  <div className="h-4 w-1/2 bg-[var(--surface-elevated)] rounded" />
                  <div className="h-3 w-3/4 bg-[var(--surface-elevated)] rounded" />
                </div>
              </div>
            ))
          ) : isError ? (
            <div className="col-span-3 p-6 rounded-xl bg-red-950/20 border border-red-800/40 text-red-300 text-xs font-mono">
              {t('dashboard.tier1_load_error')}
            </div>
          ) : !dashboard?.core || dashboard.core.length === 0 ? (
            <div className="col-span-3 p-8 rounded-xl bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-center space-y-3 flex flex-col items-center justify-center min-h-[140px] shadow-lg">
              <span className="material-symbols-outlined text-3xl text-[var(--text-muted)]">visibility_off</span>
              <p className="text-xs font-mono text-[var(--text-muted)]">
                {t('dashboard.tier1_empty_hidden')}
              </p>
              <Link
                href="/settings"
                className="px-3 py-1 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--primary-main)] font-mono text-xs font-bold transition-colors"
              >
                {t('dashboard.tier1_configure_settings')}
              </Link>
            </div>
          ) : (
            dashboard.core.map((app) => {
              const targetUrl = app.status === 'in_progress' || app.status === 'maintenance'
                ? `/under-construction?app=${encodeURIComponent(app.title || app.name || app.slug)}`
                : (app.url || app.app_url || '#');

              return (
                <div
                  key={app.id}
                  className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] group-hover:scale-105 transition-transform duration-200">
                        <span className="material-symbols-outlined text-xl">
                          {app.icon || app.icon_url || 'grid_view'}
                        </span>
                      </div>
                      <StatusBadge status={app.status || 'active'} />
                    </div>

                    <h3 className="text-base font-bold text-[var(--text-main)] group-hover:text-[var(--primary-main)] transition-colors duration-150">
                      {app.title || app.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                      {app.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                      {t('dashboard.tier1_tag')}
                    </span>
                    <Link
                      href={targetUrl}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                    >
                      <span>{t('common.launch')}</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* TIER 2: STACK INTEGRATIONS */}
      <div className="col-span-12 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-main)]">hub</span>
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <span>{t('dashboard.tier2_title')}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 font-normal uppercase">
                {t('dashboard.tier2_badge')}
              </span>
            </h2>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {t('dashboard.tier2_count', { count: dashboard?.stack ? dashboard.stack.length : 0 })}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse p-5 flex flex-col justify-between"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--surface-elevated)]" />
                <div className="space-y-2">
                  <div className="h-4 w-1/2 bg-[var(--surface-elevated)] rounded" />
                  <div className="h-3 w-3/4 bg-[var(--surface-elevated)] rounded" />
                </div>
              </div>
            ))
          ) : isError ? (
            <div className="col-span-3 p-6 rounded-xl bg-red-950/20 border border-red-800/40 text-red-300 text-xs font-mono">
              {t('dashboard.tier2_load_error')}
            </div>
          ) : !dashboard?.stack || dashboard.stack.length === 0 ? (
            <div className="col-span-3 p-8 rounded-xl bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-center space-y-3 flex flex-col items-center justify-center min-h-[140px] shadow-lg">
              <span className="material-symbols-outlined text-3xl text-[var(--text-muted)]">dns</span>
              <p className="text-xs font-mono text-[var(--text-muted)]">
                {t('dashboard.tier2_empty')}
              </p>
            </div>
          ) : (
            dashboard.stack.map((app) => {
              const targetUrl = app.status === 'in_progress' || app.status === 'maintenance'
                ? `/under-construction?app=${encodeURIComponent(app.title || app.name || app.slug)}`
                : (app.url || app.app_url || '#');

              const isInternalRoute = targetUrl.startsWith('/');

              return (
                <div
                  key={app.id}
                  className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-main)]">
                        <span className="material-symbols-outlined text-xl">
                          {app.icon || app.icon_url || 'open_in_new'}
                        </span>
                      </div>
                      <StatusBadge status={app.status || 'active'} />
                    </div>

                    <h3 className="text-base font-bold text-[var(--text-main)]">
                      {app.title || app.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                      {app.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                      {t('dashboard.tier2_tag')}
                    </span>
                    {isInternalRoute ? (
                      <Link
                        href={targetUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                      >
                        <span>{t('common.open_portal')}</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    ) : (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                      >
                        <span>{t('common.open_portal')}</span>
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* TIER 3: PERSONAL USER LINKS */}
      <div className="col-span-12 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-main)]">bookmark</span>
            <h2 className="text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <span>{t('dashboard.tier3_title')}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal uppercase">
                {t('dashboard.tier3_badge')}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {t('dashboard.tier3_count', { count: dashboard?.user ? dashboard.user.length : 0 })}
            </span>
            <button
              onClick={openAddModal}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold font-mono text-xs inline-flex items-center gap-1.5 cursor-pointer hover:bg-[var(--primary-hover)] transition-all duration-150 shadow-[0_0_12px_var(--accent-glow)]"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>{t('dashboard.tier3_add_bookmark')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse p-5 flex flex-col justify-between"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--surface-elevated)]" />
                <div className="space-y-2">
                  <div className="h-4 w-1/2 bg-[var(--surface-elevated)] rounded" />
                  <div className="h-3 w-3/4 bg-[var(--surface-elevated)] rounded" />
                </div>
              </div>
            ))
          ) : isError ? (
            <div className="col-span-3 p-6 rounded-xl bg-red-950/20 border border-red-800/40 text-red-300 text-xs font-mono">
              {t('dashboard.tier3_load_error')}
            </div>
          ) : !dashboard?.user || dashboard.user.length === 0 ? (
            <div className="col-span-3 p-8 rounded-xl bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-center space-y-3 flex flex-col items-center justify-center min-h-[140px] shadow-lg">
              <span className="material-symbols-outlined text-3xl text-[var(--text-muted)]">bookmark_border</span>
              <p className="text-xs font-mono text-[var(--text-muted)]">
                {t('dashboard.tier3_empty')}
              </p>
              <button
                onClick={openAddModal}
                className="px-3 py-1 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--primary-main)] font-mono text-xs font-bold cursor-pointer transition-colors"
              >
                {t('dashboard.tier3_create_first')}
              </button>
            </div>
          ) : (
            dashboard.user.map((app) => {
              const targetUrl = app.url || app.app_url || '#';
              const isInternalRoute = targetUrl.startsWith('/');

              return (
                <div
                  key={app.id}
                  className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--primary-main)]">
                        <span className="material-symbols-outlined text-xl">
                          {app.icon || app.icon_url || 'link'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditModal(app)}
                        className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--primary-main)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                        title={t('dashboard.tier3_edit_link')}
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </div>

                    <h3 className="text-base font-bold text-[var(--text-main)]">
                      {app.title || app.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                      {app.description || t('dashboard.tier3_personal_bookmark')}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                      {t('dashboard.tier3_custom_link')}
                    </span>
                    {isInternalRoute ? (
                      <Link
                        href={targetUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                      >
                        <span>{t('dashboard.tier3_open_link')}</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    ) : (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                      >
                        <span>{t('dashboard.tier3_open_link')}</span>
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Personal Link Modal */}
      <AddAppModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {/* Edit Personal Link Modal */}
      <EditAppModal
        app={editingApp}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingApp(null);
        }}
        onSuccess={handleSuccess}
      />
    </>
  );
}
