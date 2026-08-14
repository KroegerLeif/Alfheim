import React from 'react';
import { AlfheimLogo } from '../icons/AlfheimLogo';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { Globe, ExternalLink } from 'lucide-react';
import { Language } from '@alfheim/shared';

export const Navbar: React.FC = () => {
  const { locale, setLocale, t } = useDocTranslation();

  const navLinks = [
    { href: '#modules', label: t('docs.nav.modules', 'Modules') },
    { href: '#alfi', label: t('docs.nav.alfi', 'Meet ALFI') },
    { href: '#architecture', label: t('docs.nav.architecture', 'Architecture') },
    { href: '#stack', label: t('docs.nav.quickstart', 'Tech Stack') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1c2847]/80 bg-[#0b1326]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <a href="#" className="flex items-center gap-3 group">
          <AlfheimLogo className="w-9 h-9 transition-transform group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-[#f0f6fc] group-hover:text-[#3eb1ff] transition-colors">
              ALFHEIM
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#8b949e]">
              Sovereign OS
            </span>
          </div>
        </a>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-[#8b949e] hover:text-[#3eb1ff] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Controls: Enclave Pill + Lang Switcher + GitHub */}
        <div className="flex items-center gap-4">
          {/* Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t('docs.nav.status', 'Enclave Online')}</span>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center gap-1 bg-[#111b33] border border-[#1c2847] rounded-lg p-1">
            <Globe className="w-3.5 h-3.5 text-[#8b949e] ml-1 mr-0.5" />
            {(['en', 'de', 'pl'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={`px-2 py-0.5 text-xs font-semibold rounded uppercase transition-colors ${
                  locale === lang
                    ? 'bg-[#3eb1ff] text-[#0b1326] shadow-sm'
                    : 'text-[#8b949e] hover:text-[#f0f6fc]'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          {/* Source Repo */}
          <a
            href="https://github.com/KroegerLeif/loeger-os"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#f0f6fc] bg-[#182542] hover:bg-[#203158] border border-[#1c2847] rounded-lg transition-all"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-[#8b949e]" />
          </a>
        </div>
      </div>
    </header>
  );
};
