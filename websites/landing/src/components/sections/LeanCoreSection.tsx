import React from 'react';
import { CheckCircle2, PlusCircle, Terminal, ArrowRight } from 'lucide-react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { LEAN_CORE_SERVICES } from '../../data/leanCore';
import { docsHref } from '../../data/links';
import { SectionHeader } from './SectionHeader';
import { HardwareTierTable } from './HardwareTierTable';

/** Heading anchor of the hardware tiers in each language of the self-hosting guide. */
const HARDWARE_ANCHOR = { en: '#hardware-specifications', de: '#hardware' } as const;

/** What a default install runs, what is optional, and the hardware each tier needs. */
export const LeanCoreSection: React.FC = () => {
  const { t, locale } = useDocTranslation();

  return (
    <section
      id="lean-core"
      aria-labelledby="lean-core-title"
      className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <SectionHeader
        id="lean-core-title"
        badge={t('docs.leanCore.badge')}
        title={t('docs.leanCore.title')}
        subtitle={t('docs.leanCore.subtitle')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="flex items-center gap-2 text-lg font-bold text-fg">
            <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-success" />
            {t('docs.leanCore.coreTitle')}
          </h3>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LEAN_CORE_SERVICES.map((service) => (
              <li key={service.id} className="rounded-xl bg-canvas/60 border border-line p-3">
                <span className="block text-sm font-semibold text-fg">{service.name}</span>
                <span className="block text-xs text-muted mt-0.5">
                  {t(`docs.leanCore.services.${service.id}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <h3 className="flex items-center gap-2 text-lg font-bold text-fg">
            <PlusCircle aria-hidden="true" className="w-5 h-5 text-primary" />
            {t('docs.leanCore.optionalTitle')}
          </h3>
          <p className="mt-4 text-sm text-muted leading-relaxed">{t('docs.leanCore.optionalDesc')}</p>
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-canvas border border-line px-3 py-2 font-mono text-sm text-fg">
            <Terminal aria-hidden="true" className="w-4 h-4 text-primary shrink-0" />
            <code>alfheim-setup apps enable &lt;name&gt;</code>
          </p>
          <a
            href={docsHref(locale, 'how-to/manage-apps/')}
            className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
          >
            {t('docs.leanCore.manageAppsLink')}
            <ArrowRight aria-hidden="true" className="w-4 h-4" />
          </a>
        </div>
      </div>

      <HardwareTierTable />

      <p className="mt-4 text-sm text-muted">
        {t('docs.leanCore.source')}{' '}
        <a
          href={`${docsHref(locale, 'how-to/homelab-deployment/')}${HARDWARE_ANCHOR[locale === 'de' ? 'de' : 'en']}`}
          className="font-semibold text-primary hover:text-primary-hover underline underline-offset-2"
        >
          {t('docs.leanCore.sourceLink')}
        </a>
      </p>
    </section>
  );
};
