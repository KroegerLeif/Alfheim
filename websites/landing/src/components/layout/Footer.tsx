import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { AlfheimLogo } from '../icons/AlfheimLogo';
import { GithubMark } from '../icons/GithubMark';
import { Shield } from 'lucide-react';

export const Footer: React.FC = () => {
  const { t } = useDocTranslation();

  return (
    <footer className="border-t border-[#1c2847] bg-[#080e1e] py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand info */}
        <div className="flex items-center gap-3">
          <AlfheimLogo className="w-7 h-7" size={28} />
          <div>
            <span className="font-bold text-sm text-[#f0f6fc]">Alfheim Sovereign OS</span>
            <p className="text-xs text-[#8b949e] mt-0.5">
              {t('docs.footer.copyright')}
            </p>
          </div>
        </div>

        {/* Badges & Meta */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#8b949e]">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#111b33] border border-[#1c2847]">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            {t('docs.footer.zero_trust_badge')}
          </span>
          <a
            href="https://github.com/KroegerLeif/Alfheim"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-[#3eb1ff] transition-colors"
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
