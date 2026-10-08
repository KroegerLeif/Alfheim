import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { ArrowRight, BookOpen } from 'lucide-react';
import { AlfheimLogo } from '../icons/AlfheimLogo';

export const HeroSection: React.FC = () => {
  const { t } = useDocTranslation();

  const metrics = [
    { id: 'architecture', noteColor: 'text-[#3eb1ff]' },
    { id: 'identity', noteColor: 'text-emerald-400' },
    { id: 'storage', noteColor: 'text-sky-400' },
    { id: 'ai', noteColor: 'text-amber-400' },
  ];

  return (
    <section className="relative pt-12 pb-16 overflow-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#3eb1ff]/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111b33] border border-[#1c2847] text-xs font-mono text-[#3eb1ff] mb-6 glow-pill">
          <AlfheimLogo className="w-4 h-4" size={16} />
          <span>{t('docs.hero.badge')}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#3eb1ff]" />
          <span className="text-[#8b949e]">v2.4 LTS</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-[#f0f6fc] max-w-4xl mx-auto leading-tight sm:leading-none">
          {t('docs.hero.title')}
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-[#8b949e] max-w-3xl mx-auto leading-relaxed">
          {t('docs.hero.subtitle')}
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="#modules"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#3eb1ff] text-[#0b1326] font-semibold text-sm hover:bg-[#60beff] shadow-lg shadow-[#3eb1ff]/20 transition-all hover:scale-[1.02]"
          >
            <span>{t('docs.hero.exploreModules')}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#architecture"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#111b33] text-[#f0f6fc] font-semibold text-sm border border-[#1c2847] hover:border-[#3eb1ff]/40 hover:bg-[#182542] transition-all"
          >
            <BookOpen className="w-4 h-4 text-[#3eb1ff]" />
            <span>{t('docs.hero.readArchitecture')}</span>
          </a>
        </div>

        {/* Key Metrics Bar */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {metrics.map(({ id, noteColor }) => (
            <div key={id} className="glass-card rounded-xl p-4 text-left">
              <div className="text-xs font-mono text-[#8b949e] uppercase">{t(`docs.hero.metrics.${id}.label`)}</div>
              <div className="text-xl font-bold text-[#f0f6fc] mt-1">{t(`docs.hero.metrics.${id}.value`)}</div>
              <div className={`text-xs ${noteColor} mt-0.5`}>{t(`docs.hero.metrics.${id}.note`)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
