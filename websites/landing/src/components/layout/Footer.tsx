import React from 'react';
import { GithubMark } from '@alfheim/shared';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { AlfheimLogo } from '../icons/AlfheimLogo';
import { docsHref, GITHUB_URL } from '../../data/links';

/** Page footer: brand line, changelog, GitHub and licence. */
export const Footer: React.FC = () => {
  const { t, locale } = useDocTranslation();

  return (
    <footer className="border-t border-line bg-canvas py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <AlfheimLogo className="w-7 h-7" size={28} />
          <div>
            <span className="font-bold text-sm text-fg">Alfheim</span>
            <p className="text-xs text-muted mt-0.5">{t('docs.footer.tagline')}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <a href={docsHref(locale, 'changelog/')} className="hover:text-primary transition-colors">
            {t('docs.footer.changelog')}
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <GithubMark className="w-4 h-4" />
            <span>GitHub</span>
          </a>
          <span>{t('docs.footer.license')}</span>
        </div>
      </div>
    </footer>
  );
};
