import React from 'react';
import { Flag, ExternalLink } from 'lucide-react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { ROADMAP } from '../../data/roadmap';
import { SectionHeader } from './SectionHeader';

/** Themes of the next releases, each linked to its GitHub milestone. */
export const RoadmapSection: React.FC = () => {
  const { t } = useDocTranslation();

  return (
    <section
      id="roadmap"
      aria-labelledby="roadmap-title"
      className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
    >
      <SectionHeader
        id="roadmap-title"
        badge={t('docs.roadmap.badge')}
        title={t('docs.roadmap.title')}
        subtitle={t('docs.roadmap.subtitle')}
      />

      <ol className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {ROADMAP.map((release) => (
          <li key={release.id} className="glass-card rounded-2xl p-6 flex flex-col">
            <h3 className="flex items-center gap-2 text-xl font-bold text-fg">
              <Flag aria-hidden="true" className="w-5 h-5 text-primary" />
              {release.version}
              <span className="text-sm font-normal text-muted">
                {t(`docs.roadmap.releases.${release.id}.title`)}
              </span>
            </h3>
            <p className="mt-3 text-sm text-muted leading-relaxed">
              {t(`docs.roadmap.releases.${release.id}.theme`)}
            </p>
            <a
              href={release.milestoneUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
            >
              {t('docs.roadmap.milestoneLink', { version: release.version })}
              <ExternalLink aria-hidden="true" className="w-4 h-4" />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
};
