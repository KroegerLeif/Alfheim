import React from 'react';
import { Database, Globe2 } from 'lucide-react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import type { AppModule } from './appModules';

/** Props of {@link AppModuleCard}. */
interface AppModuleCardProps {
  app: AppModule;
}

/** Card for one module in the landing page grid: icon, tech badge, texts and metadata. */
export const AppModuleCard: React.FC<AppModuleCardProps> = ({ app }) => {
  const { t } = useDocTranslation();
  const Icon = app.icon;

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col justify-between transition-all hover:-translate-y-1 relative overflow-hidden group">
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
          {t(`docs.modules.${app.id}.name`)}
        </h3>
        <p className="text-xs font-mono text-[#3eb1ff] mt-0.5">{t(`docs.modules.${app.id}.tagline`)}</p>
        <p className="text-sm text-[#8b949e] mt-3 leading-relaxed">{t(`docs.modules.${app.id}.description`)}</p>
      </div>

      {/* Card Footer / Metadata */}
      <div className="mt-6 pt-4 border-t border-[#1c2847]/80 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-[#8b949e]">
          <span className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#3eb1ff]" />
            {t('docs.modules.storage_label')}
          </span>
          <span className="text-[#f0f6fc]">{app.db}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono text-[#8b949e]">
          <span className="flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5 text-[#3eb1ff]" />
            {t('docs.modules.basepath_label')}
          </span>
          <span className="text-[#3eb1ff] bg-[#0b1326] px-1.5 py-0.5 rounded border border-[#1c2847]">
            {app.route}
          </span>
        </div>
      </div>
    </div>
  );
};
