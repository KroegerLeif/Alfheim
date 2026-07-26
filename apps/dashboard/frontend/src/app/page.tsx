'use client';

import { useState } from 'react';
import { useAppCatalog, useCreateApp } from '@/features/apps';
import { SystemHealthWidget } from '@/features/dashboard/components/SystemHealthWidget';
import { SystemShellLogs } from '@/features/dashboard/components/SystemShellLogs';
import Link from 'next/link';

/**
 * Root Dashboard View.
 * Renders live telemetry stats, interactive terminal log shell, and dynamic PostgreSQL app catalog.
 * Supports adding runtime applications via POST /api/v1/apps.
 */
export default function DashboardPage() {
  const { data: catalog, isLoading, isError, refetch } = useAppCatalog();
  const createAppMutation = useCreateApp();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('grid_view');
  const [category, setCategory] = useState<'internal' | 'external'>('internal');
  const [status, setStatus] = useState<'active' | 'in_progress' | 'maintenance'>('active');

  const handleAddAppSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !url) return;

    createAppMutation.mutate(
      {
        title,
        description,
        icon,
        url,
        is_external: category === 'external',
        category,
        status,
      },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          setTitle('');
          setDescription('');
          setUrl('');
          setIcon('grid_view');
          setCategory('internal');
          setStatus('active');
        },
      }
    );
  };

  const renderStatusBadge = (appStatus?: string) => {
    switch (appStatus) {
      case 'in_progress':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 font-bold">
            In Progress
          </span>
        );
      case 'maintenance':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-red-950/60 text-red-400 border border-red-800/40 font-bold">
            Maintenance
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-bold">
            Active
          </span>
        );
    }
  };

  return (
    <>
      {/* System Health Telemetry Widget */}
      <SystemHealthWidget />

      {/* Live System Shell / Terminal Log Feed */}
      <SystemShellLogs />

      {/* Internal Applications Section */}
      <div className="col-span-12 mt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-main)]">apps</span>
            <h2 className="text-lg font-bold text-[var(--text-main)]">Internal Services</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {catalog?.internal.length || 0} Registered
            </span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1 rounded bg-[var(--primary-main)] text-slate-950 font-semibold font-mono text-xs flex items-center gap-1.5 cursor-pointer hover:bg-[var(--primary-hover)] transition-all duration-150 shadow-md"
            >
              <span className="material-symbols-outlined text-sm font-bold">add</span>
              Add App
            </button>
            <button
              onClick={() => refetch()}
              className="px-2.5 py-1 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-150"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Sync
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
              Failed to load internal app catalog. Please check backend connection.
            </div>
          ) : (
            catalog?.internal.map((app) => {
              const targetUrl = app.status === 'in_progress' || app.status === 'maintenance'
                ? `/under-construction?app=${encodeURIComponent(app.title || app.name)}`
                : (app.url || app.app_url);

              const isExt = app.is_external || app.category === 'external';

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
                      {renderStatusBadge(app.status)}
                    </div>

                    <h3 className="text-base font-bold text-[var(--text-main)] group-hover:text-[var(--primary-main)] transition-colors duration-150">
                      {app.title || app.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                      {app.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                      Role: {app.required_role || 'MEMBER'}
                    </span>
                    {isExt ? (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                      >
                        <span>Launch</span>
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                    ) : (
                      <Link
                        href={targetUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                      >
                        <span>Launch</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* External Applications Section */}
      <div className="col-span-12 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-main)]">open_in_new</span>
            <h2 className="text-lg font-bold text-[var(--text-main)]">External Services & Portals</h2>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {catalog?.external.length || 0} Portals
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {catalog?.external.map((app) => {
            const targetUrl = app.status === 'in_progress' || app.status === 'maintenance'
              ? `/under-construction?app=${encodeURIComponent(app.title || app.name)}`
              : (app.url || app.app_url);

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
                        {app.icon || app.icon_url || 'link'}
                      </span>
                    </div>
                    {renderStatusBadge(app.status)}
                  </div>

                  <h3 className="text-base font-bold text-[var(--text-main)]">
                    {app.title || app.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                    {app.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                    External Service
                  </span>
                  {isInternalRoute ? (
                    <Link
                      href={targetUrl}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                    >
                      <span>Open Portal</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  ) : (
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                    >
                      <span>Open Portal</span>
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add App Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--primary-main)]">add_box</span>
                <h3 className="text-base font-bold text-[var(--text-main)]">Register New Service</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddAppSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                  Service Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Grafana Dashboards"
                  required
                  className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                  Service URL *
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. /grafana or http://grafana.local"
                  required
                  className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of service..."
                  rows={2}
                  className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as 'internal' | 'external')}
                    className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                  >
                    <option value="internal">Internal App</option>
                    <option value="external">External Service</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'in_progress' | 'maintenance')}
                    className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                  >
                    <option value="active">Active</option>
                    <option value="in_progress">In Progress</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                  Material Icon Name
                </label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="e.g. analytics, cloud, build, home"
                  className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAppMutation.isPending}
                  className="px-5 py-2 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50"
                >
                  {createAppMutation.isPending ? 'Registering...' : 'Register App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
