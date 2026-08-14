import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import {
  Package,
  ShoppingCart,
  Wrench,
  CheckSquare,
  LayoutDashboard,
  Database,
  Globe2,
} from 'lucide-react';

export const AppsGrid: React.FC = () => {
  const { t } = useDocTranslation();

  const apps = [
    {
      id: 'pantry',
      icon: Package,
      color: 'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/30',
      tagColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      name: t('docs.modules.pantry.name', 'Digital Pantry'),
      tagline: t('docs.modules.pantry.tagline', 'Inventory & Stock Lifecycle'),
      description: t(
        'docs.modules.pantry.description',
        'Live stock tracking, barcode lookup via OpenFoodFacts, storage location management, and an immutable inventory transaction ledger.'
      ),
      tech: 'FastAPI + Next.js',
      db: 'PostgreSQL (pantry-db)',
      route: '/pantry',
      api: 'api.alfheim.loegien.de/pantry/api/v1',
    },
    {
      id: 'shopping',
      icon: ShoppingCart,
      color: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/30',
      tagColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      name: t('docs.modules.shopping.name', 'Shopping Lists'),
      tagline: t('docs.modules.shopping.tagline', 'Collaborative Realtime Lists'),
      description: t(
        'docs.modules.shopping.description',
        'Multi-tenant household and personal shopping lists with auto-sync from pantry deficits and category sorting.'
      ),
      tech: 'FastAPI + Next.js',
      db: 'PostgreSQL (shopping-db)',
      route: '/shopping',
      api: 'api.alfheim.loegien.de/shopping/api/v1',
    },
    {
      id: 'maintenance',
      icon: Wrench,
      color: 'from-blue-500/20 to-indigo-500/10 text-blue-400 border-blue-500/30',
      tagColor: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
      name: t('docs.modules.maintenance.name', 'Home Maintenance'),
      tagline: t('docs.modules.maintenance.tagline', 'Asset & Task Lifecycle'),
      description: t(
        'docs.modules.maintenance.description',
        'Preventative maintenance scheduling, warranty storage in RustFS S3, recurring alerts, and household equipment tracking.'
      ),
      tech: 'FastAPI + Next.js',
      db: 'PostgreSQL (maintenance-db)',
      route: '/maintenance',
      api: 'api.alfheim.loegien.de/maintenance/api/v1',
    },
    {
      id: 'chores',
      icon: CheckSquare,
      color: 'from-purple-500/20 to-pink-500/10 text-purple-400 border-purple-500/30',
      tagColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      name: t('docs.modules.chores.name', 'Household Chores'),
      tagline: t('docs.modules.chores.tagline', 'Gamified Habit Tracker'),
      description: t(
        'docs.modules.chores.description',
        'Recurring chore rotation, streak rewards, points system, and fair household member workload distribution.'
      ),
      tech: 'FastAPI + Next.js',
      db: 'PostgreSQL (chores-db)',
      route: '/chores',
      api: 'api.alfheim.loegien.de/api/v1/chores',
    },
    {
      id: 'dashboard',
      icon: LayoutDashboard,
      color: 'from-sky-500/20 to-cyan-500/10 text-sky-400 border-sky-500/30',
      tagColor: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      name: t('docs.modules.dashboard.name', 'Control Plane'),
      tagline: t('docs.modules.dashboard.tagline', 'Central Management & Ingress'),
      description: t(
        'docs.modules.dashboard.description',
        'Unified OIDC authentication brokering, live telemetry streaming, catalog management, and Caddy reverse proxy routing.'
      ),
      tech: 'Go 1.23 + Next.js',
      db: 'PostgreSQL (dashboard-db)',
      route: '/',
      api: 'api.alfheim.loegien.de/api/v1/apps',
    },
  ];

  return (
    <section id="modules" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-[#111b33] border border-[#1c2847] text-[#3eb1ff]">
          {t('docs.modules.badge', 'Microservices')}
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f6fc] mt-3">
          {t('docs.modules.title', 'Integrated Platform Modules')}
        </h2>
        <p className="text-[#8b949e] mt-3 text-base">
          {t(
            'docs.modules.subtitle',
            'Containerized microservices built with Python FastAPI, Go, and Next.js isolated across dedicated Docker bridge networks.'
          )}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.id}
              className="glass-card rounded-2xl p-6 flex flex-col justify-between transition-all hover:-translate-y-1 relative overflow-hidden group"
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br border ${app.color}`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-xs font-mono px-2.5 py-1 rounded-md border ${app.tagColor}`}>
                    {app.tech}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-[#f0f6fc] group-hover:text-[#3eb1ff] transition-colors">
                  {app.name}
                </h3>
                <p className="text-xs font-mono text-[#3eb1ff] mt-0.5">{app.tagline}</p>
                <p className="text-sm text-[#8b949e] mt-3 leading-relaxed">{app.description}</p>
              </div>

              {/* Card Footer / Metadata */}
              <div className="mt-6 pt-4 border-t border-[#1c2847]/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-[#8b949e]">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[#3eb1ff]" />
                    Storage
                  </span>
                  <span className="text-[#f0f6fc]">{app.db}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-[#8b949e]">
                  <span className="flex items-center gap-1.5">
                    <Globe2 className="w-3.5 h-3.5 text-[#3eb1ff]" />
                    Frontend BasePath
                  </span>
                  <span className="text-[#3eb1ff] bg-[#0b1326] px-1.5 py-0.5 rounded border border-[#1c2847]">
                    {app.route}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
