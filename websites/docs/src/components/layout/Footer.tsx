import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { AlfheimLogo } from '../icons/AlfheimLogo';
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
              {t('docs.footer.copyright', '© 2026 Alfheim Sovereign OS. All rights reserved.')}
            </p>
          </div>
        </div>

        {/* Badges & Meta */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[#8b949e]">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#111b33] border border-[#1c2847]">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            Zero-Trust Architecture
          </span>
          <a
            href="https://github.com/KroegerLeif/loeger-os"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-[#3eb1ff] transition-colors"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </a>
          <span>{t('docs.footer.license', 'Licensed under MIT')}</span>
        </div>
      </div>
    </footer>
  );
};
