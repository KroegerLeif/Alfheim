import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { APP_MODULES } from './appModules';
import { AppModuleCard } from './AppModuleCard';

export const AppsGrid: React.FC = () => {
  const { t } = useDocTranslation();

  return (
    <section id="modules" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-[#111b33] border border-[#1c2847] text-[#3eb1ff]">
          {t('docs.modules.badge')}
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f6fc] mt-3">
          {t('docs.modules.title')}
        </h2>
        <p className="text-[#8b949e] mt-3 text-base">
          {t('docs.modules.subtitle')}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {APP_MODULES.map((app) => (
          <AppModuleCard key={app.id} app={app} />
        ))}
      </div>
    </section>
  );
};
