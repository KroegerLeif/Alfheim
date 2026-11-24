import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { APP_MODULES } from '../../data/modules';
import { docsHref } from '../../data/links';
import { SectionHeader } from './SectionHeader';
import { AppModuleCard } from './AppModuleCard';

/** Grid of every module, marked Core or Optional. */
export const AppsGrid: React.FC = () => {
  const { t, locale } = useDocTranslation();

  return (
    <section
      id="modules"
      aria-labelledby="modules-title"
      className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <SectionHeader
        id="modules-title"
        badge={t('docs.modules.badge')}
        title={t('docs.modules.title')}
        subtitle={t('docs.modules.subtitle')}
      />

      <p className="-mt-8 mb-10 text-center">
        <a
          href={docsHref(locale, 'reference/ingress-matrix/')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
        >
          {t('docs.modules.ingressLink')}
          <ArrowRight aria-hidden="true" className="w-4 h-4" />
        </a>
      </p>

      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {APP_MODULES.map((app) => (
          <AppModuleCard key={app.id} app={app} />
        ))}
      </ul>
    </section>
  );
};
