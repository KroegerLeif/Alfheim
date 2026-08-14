import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { Code2, Server, Database, Container } from 'lucide-react';

export const TechStackSection: React.FC = () => {
  const { t } = useDocTranslation();

  const stackItems = [
    {
      category: t('docs.techStack.categories.frontends', 'Frontends & UI'),
      icon: Code2,
      color: 'text-sky-400',
      items: ['Next.js 16 (App Router)', 'React 19', 'Tailwind CSS v4', 'Lucide React', '@alfheim/shared'],
    },
    {
      category: t('docs.techStack.categories.backends', 'API Backends'),
      icon: Server,
      color: 'text-emerald-400',
      items: ['Python 3.12 (FastAPI)', 'Go 1.23 (Control Plane)', 'SQLAlchemy 2.0 & asyncpg', 'Pydantic v2'],
    },
    {
      category: t('docs.techStack.categories.databases', 'Databases & Storage'),
      icon: Database,
      color: 'text-amber-400',
      items: ['PostgreSQL 16 (Isolated instances)', 'RustFS (High-performance S3)', 'VictoriaStack (Metrics & Logs)', 'Redis (Caching)'],
    },
    {
      category: t('docs.techStack.categories.platform', 'Platform & Mesh'),
      icon: Container,
      color: 'text-purple-400',
      items: ['Docker Compose & Multi-Bridge Networks', 'Caddy 2 Reverse Proxy', 'Keycloak 24 (OIDC / OAuth2)', 'WireGuard / Tailscale Enclave'],
    },
  ];

  return (
    <section id="stack" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-[#111b33] border border-[#1c2847] text-[#3eb1ff]">
          {t('docs.techStack.badge', 'Engineering')}
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f6fc] mt-3">
          {t('docs.techStack.title', 'Technology Stack')}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stackItems.map((group, idx) => {
          const Icon = group.icon;
          return (
            <div key={idx} className="glass-card rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`w-5 h-5 ${group.color}`} />
                  <h3 className="font-bold text-sm text-[#f0f6fc] uppercase font-mono">{group.category}</h3>
                </div>
                <ul className="space-y-2 text-xs text-[#8b949e]">
                  {group.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3eb1ff]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
