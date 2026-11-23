import React from 'react';
import { Globe, ExternalLink, BookOpen } from 'lucide-react';
import { Language } from '@alfheim/shared';
import { AlfheimLogo } from '../icons/AlfheimLogo';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { docsHref, GITHUB_URL } from '../../data/links';

const LANGUAGES: readonly Language[] = ['en', 'de', 'pl'];

/** Sticky header: brand, section links, docs link, language switcher and GitHub. */
export const Navbar: React.FC = () => {
  const { locale, setLocale, t } = useDocTranslation();

  const navLinks = [
    { href: '#lean-core', label: t('docs.nav.leanCore') },
    { href: '#modules', label: t('docs.nav.modules') },
    { href: '#integrations', label: t('docs.nav.integrations') },
    { href: '#roadmap', label: t('docs.nav.roadmap') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-line/80 bg-canvas/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <a href="#" className="flex items-center gap-3 group" aria-label={t('docs.nav.home')}>
          <AlfheimLogo className="w-9 h-9 transition-transform group-hover:scale-105" />
          <span className="hidden sm:block font-bold text-lg tracking-tight text-fg group-hover:text-primary transition-colors">
            ALFHEIM
          </span>
        </a>

        <nav aria-label={t('docs.nav.sections')} className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted hover:text-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={docsHref(locale)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-canvas bg-primary hover:bg-primary-hover rounded-lg transition-colors"
          >
            <BookOpen aria-hidden="true" className="w-3.5 h-3.5" />
            <span>{t('docs.nav.documentation')}</span>
          </a>

          <div
            role="group"
            aria-label={t('docs.nav.language')}
            className="flex items-center gap-1 bg-card border border-line rounded-lg p-1"
          >
            <Globe aria-hidden="true" className="w-3.5 h-3.5 text-muted ml-1 mr-0.5" />
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                lang={lang}
                aria-pressed={locale === lang}
                onClick={() => setLocale(lang)}
                className={`px-2 py-0.5 text-xs font-semibold rounded uppercase transition-colors ${
                  locale === lang ? 'bg-primary text-canvas' : 'text-muted hover:text-fg'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-fg bg-elevated hover:bg-card border border-line rounded-lg transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink aria-hidden="true" className="w-3 h-3 text-muted" />
          </a>
        </div>
      </div>
    </header>
  );
};
