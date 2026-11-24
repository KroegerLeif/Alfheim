import React from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { AlfheimLogo } from '../icons/AlfheimLogo';
import { docsHref } from '../../data/links';

/** Opening section: release badge, one-sentence pitch and the Install / Read the docs CTAs. */
export const HeroSection: React.FC = () => {
  const { t, locale } = useDocTranslation();

  return (
    <section aria-labelledby="hero-title" className="relative pt-16 pb-16 overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-line text-xs font-mono text-primary mb-6">
          <AlfheimLogo className="w-4 h-4" size={16} />
          <span>{t('docs.hero.releaseLabel')}</span>
          <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-muted">{__ALFHEIM_RELEASE__}</span>
        </div>

        <h1
          id="hero-title"
          className="text-4xl sm:text-6xl font-extrabold tracking-tight text-fg max-w-4xl mx-auto leading-tight sm:leading-none"
        >
          {t('docs.hero.title')}
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-muted max-w-3xl mx-auto leading-relaxed">
          {t('docs.hero.subtitle')}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={docsHref(locale, 'how-to/homelab-deployment/')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-canvas font-semibold text-sm hover:bg-primary-hover transition-colors"
          >
            <span>{t('docs.hero.install')}</span>
            <ArrowRight aria-hidden="true" className="w-4 h-4" />
          </a>
          <a
            href={docsHref(locale)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-card text-fg font-semibold text-sm border border-line hover:border-primary/40 hover:bg-elevated transition-colors"
          >
            <BookOpen aria-hidden="true" className="w-4 h-4 text-primary" />
            <span>{t('docs.hero.readDocs')}</span>
          </a>
        </div>
      </div>
    </section>
  );
};
