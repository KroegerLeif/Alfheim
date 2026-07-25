'use client';

import { useAppCatalog } from '@/features/apps';
import { SystemHealthWidget } from '@/features/dashboard/components/SystemHealthWidget';
import { SystemShellLogs } from '@/features/dashboard/components/SystemShellLogs';
import Link from 'next/link';

/**
 * Root Dashboard View.
 * Renders live telemetry stats, interactive terminal log shell, and dynamic app catalog.
 */
export default function DashboardPage() {
  const { data: catalog, isLoading, isError, refetch } = useAppCatalog();

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
            catalog?.internal.map((app) => (
              <div
                key={app.id}
                className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] group-hover:scale-105 transition-transform duration-200">
                      <span className="material-symbols-outlined text-xl">
                        {app.icon_url || 'grid_view'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-[var(--surface-canvas)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                      {app.category}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[var(--text-main)] group-hover:text-[var(--primary-main)] transition-colors duration-150">
                    {app.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                    {app.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                    Role: {app.required_role}
                  </span>
                  <Link
                    href={app.app_url}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                  >
                    <span>Launch</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* External Applications Section */}
      <div className="col-span-12 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-main)]">open_in_new</span>
            <h2 className="text-lg font-bold text-[var(--text-main)]">External & Infrastructure Portals</h2>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {catalog?.external.length || 0} Portals
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {catalog?.external.map((app) => (
            <div
              key={app.id}
              className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 transition-all duration-200 flex flex-col justify-between group shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-main)]">
                    <span className="material-symbols-outlined text-xl">
                      {app.icon_url || 'link'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-[var(--surface-canvas)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                    {app.category}
                  </span>
                </div>

                <h3 className="text-base font-bold text-[var(--text-main)]">
                  {app.name}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1.5 line-clamp-2 leading-relaxed">
                  {app.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">
                  External URL
                </span>
                <a
                  href={app.app_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary-main)] hover:underline"
                >
                  <span>Open Portal</span>
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
