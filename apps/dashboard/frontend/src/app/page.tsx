/**
 * Root Dashboard Overview Page.
 * Utilizes 12-column CSS grid utility classes defined in globals.css.
 */
export default function DashboardPage() {
  return (
    <>
      {/* Top Banner / Welcome Widget */}
      <div className="col-span-12 p-6 rounded-2xl bg-gradient-to-r from-[var(--surface-card)] via-[var(--surface-elevated)] to-[var(--surface-card)] border border-[var(--border-subtle)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary-main)]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--primary-main)]/10 border border-[var(--border-accent)] text-[var(--primary-main)] text-xs font-mono mb-3">
              <span className="material-symbols-outlined text-sm">verified</span>
              Phase 1 Shell Active
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-main)]">
              System Overview & Control
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Real-time monitoring and orchestration for Loeger OS micro-services.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-slate-950 font-semibold text-xs hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-[0_0_15px_var(--accent-glow)] cursor-pointer">
              Deploy Service
            </button>
          </div>
        </div>
      </div>

      {/* Grid Cards (12-column layout testing) */}
      <div className="col-span-12 md:col-span-4 p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all duration-200">
        <div className="flex items-center justify-between text-[var(--text-muted)] mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">Active Services</span>
          <span className="material-symbols-outlined text-lg text-[var(--primary-main)]">dns</span>
        </div>
        <div className="text-2xl font-bold font-mono text-[var(--text-main)]">6 / 6</div>
        <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          All containers healthy
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all duration-200">
        <div className="flex items-center justify-between text-[var(--text-muted)] mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">Pantry Backend API</span>
          <span className="material-symbols-outlined text-lg text-[var(--primary-main)]">api</span>
        </div>
        <div className="text-2xl font-bold font-mono text-[var(--text-main)]">99.98%</div>
        <div className="text-xs text-[var(--text-muted)] mt-2 font-mono">
          Avg Response: 12ms
        </div>
      </div>

      <div className="col-span-12 md:col-span-4 p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all duration-200">
        <div className="flex items-center justify-between text-[var(--text-muted)] mb-3">
          <span className="text-xs font-mono uppercase tracking-wider">IAM Authentication</span>
          <span className="material-symbols-outlined text-lg text-[var(--primary-main)]">lock</span>
        </div>
        <div className="text-2xl font-bold font-mono text-[var(--text-main)]">Keycloak</div>
        <div className="text-xs text-[var(--primary-main)] mt-2 font-mono">
          OAuth2 / OIDC Secured
        </div>
      </div>

      {/* Feature Showcase Grid Section */}
      <div className="col-span-12 md:col-span-8 p-6 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
          Stitch Obsidian Flux Architecture
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Integrated with 12-column grid utilities, custom CSS variables, and persistent sidebar shell.
        </p>

        <div className="space-y-3">
          <div className="p-3.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <span className="font-mono text-[var(--text-main)]">Sidebar width: 280px persistent</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">VERIFIED</span>
          </div>
          <div className="p-3.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <span className="font-mono text-[var(--text-main)]">TanStack Query v5 & Ky Integration</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">VERIFIED</span>
          </div>
          <div className="p-3.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
            <span className="font-mono text-[var(--text-main)]">Google Material Symbols Outlined</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">VERIFIED</span>
          </div>
        </div>
      </div>

      {/* Side Quick Actions */}
      <div className="col-span-12 md:col-span-4 p-6 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
          Quick Actions
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Platform quick commands
        </p>
        <div className="space-y-2">
          <button className="w-full text-left p-3 rounded-lg bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/40 text-xs font-mono text-[var(--text-main)] transition-all duration-150 flex items-center justify-between group cursor-pointer">
            <span>View Micro-Services</span>
            <span className="material-symbols-outlined text-sm text-[var(--text-muted)] group-hover:text-[var(--primary-main)]">chevron_right</span>
          </button>
          <button className="w-full text-left p-3 rounded-lg bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/40 text-xs font-mono text-[var(--text-main)] transition-all duration-150 flex items-center justify-between group cursor-pointer">
            <span>Audit Gateway Proxy</span>
            <span className="material-symbols-outlined text-sm text-[var(--text-muted)] group-hover:text-[var(--primary-main)]">chevron_right</span>
          </button>
        </div>
      </div>
    </>
  );
}
