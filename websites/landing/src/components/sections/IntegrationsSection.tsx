import React from 'react';
import { ArrowRight, ExternalLink, Home, Music, Bot, Puzzle, type LucideIcon } from 'lucide-react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { docsHref } from '../../data/links';
import { SectionHeader } from './SectionHeader';

/** A typed plugin named in ADR 0010; text under `docs.integrations.plugins.items.<id>`. */
const PLUGINS: readonly { id: 'homeAssistant' | 'media' | 'llm'; icon: LucideIcon }[] = [
  { id: 'homeAssistant', icon: Home },
  { id: 'media', icon: Music },
  { id: 'llm', icon: Bot },
];

/** Badge for features that are not released yet. */
const PlannedBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="text-xs font-mono px-2.5 py-1 rounded-md border bg-warning/10 text-warning border-warning/30 whitespace-nowrap">
    {label}
  </span>
);

/** The two integration layers of ADR 0010: launchers (links only) and typed plugins. */
export const IntegrationsSection: React.FC = () => {
  const { t, locale } = useDocTranslation();
  const planned = t('docs.integrations.planned');

  return (
    <section
      id="integrations"
      aria-labelledby="integrations-title"
      className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <SectionHeader
        id="integrations-title"
        badge={t('docs.integrations.badge')}
        title={t('docs.integrations.title')}
        subtitle={t('docs.integrations.subtitle')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <article className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-bold text-fg">
              <ExternalLink aria-hidden="true" className="w-5 h-5 text-primary" />
              {t('docs.integrations.launchers.title')}
            </h3>
            <PlannedBadge label={planned} />
          </div>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            {t('docs.integrations.launchers.description')}
          </p>
          <p className="mt-3 text-sm text-muted leading-relaxed">{t('docs.integrations.launchers.today')}</p>
        </article>

        <article className="glass-card rounded-2xl p-6 lg:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="flex items-center gap-2 text-lg font-bold text-fg">
              <Puzzle aria-hidden="true" className="w-5 h-5 text-primary" />
              {t('docs.integrations.plugins.title')}
            </h3>
            <PlannedBadge label={planned} />
          </div>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            {t('docs.integrations.plugins.description')}
          </p>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLUGINS.map(({ id, icon: Icon }) => (
              <li key={id} className="rounded-xl bg-canvas/60 border border-line p-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Icon aria-hidden="true" className="w-4 h-4 text-primary" />
                  {t(`docs.integrations.plugins.items.${id}.name`)}
                </span>
                <span className="block text-xs text-muted mt-1 leading-relaxed">
                  {t(`docs.integrations.plugins.items.${id}.description`)}
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <p className="mt-6 text-center">
        <a
          href={docsHref(locale, 'explanation/decisions/0010-integration-architecture/')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
        >
          {t('docs.integrations.adrLink')}
          <ArrowRight aria-hidden="true" className="w-4 h-4" />
        </a>
      </p>
    </section>
  );
};
