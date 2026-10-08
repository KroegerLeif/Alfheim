import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { ShieldCheck, HardDrive, Network, Activity, NetworkIcon } from 'lucide-react';

export const ArchitectureSection: React.FC = () => {
  const { t } = useDocTranslation();

  const pillars = [
    {
      id: 'iam',
      icon: ShieldCheck,
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      title: t('docs.architecture.pillars.iam.title'),
      desc: t('docs.architecture.pillars.iam.desc'),
    },
    {
      id: 'storage',
      icon: HardDrive,
      color: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      title: t('docs.architecture.pillars.storage.title'),
      desc: t('docs.architecture.pillars.storage.desc'),
    },
    {
      id: 'proxy',
      icon: Network,
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      title: t('docs.architecture.pillars.proxy.title'),
      desc: t('docs.architecture.pillars.proxy.desc'),
    },
    {
      id: 'observability',
      icon: Activity,
      color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      title: t('docs.architecture.pillars.observability.title'),
      desc: t('docs.architecture.pillars.observability.desc'),
    },
  ];

  const zones = [
    { id: 'gateway', network: 'gateway-net', border: 'border-sky-500/30', title: 'text-[#3eb1ff]', note: 'text-sky-400/80' },
    { id: 'infra', network: 'infra-net', border: 'border-emerald-500/30', title: 'text-emerald-400', note: 'text-emerald-400/80' },
    { id: 'core', network: 'core-net', border: 'border-cyan-500/30', title: 'text-cyan-400', note: 'text-cyan-400/80' },
    { id: 'apps', network: 'app-*-net', border: 'border-purple-500/30', title: 'text-purple-400', note: 'text-purple-400/80' },
  ];

  return (
    <section id="architecture" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-[#111b33] border border-[#1c2847] text-[#3eb1ff]">
          {t('docs.architecture.badge')}
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f6fc] mt-3">
          {t('docs.architecture.title')}
        </h2>
        <p className="text-[#8b949e] mt-3 text-base">
          {t('docs.architecture.subtitle')}
        </p>
      </div>

      {/* Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div key={pillar.id} className="glass-card rounded-2xl p-6 relative group">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${pillar.color}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#f0f6fc]">{pillar.title}</h3>
                  <p className="text-sm text-[#8b949e] mt-2 leading-relaxed">{pillar.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Network Segmentation Visual Diagram */}
      <div className="mt-10 glass-card rounded-2xl p-6 sm:p-8 border border-[#1c2847]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#3eb1ff] mb-4">
          <NetworkIcon className="w-4 h-4" />
          <span>{t('docs.architecture.diagram_title')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
          {zones.map((zone) => (
            <div key={zone.id} className={`p-4 rounded-xl bg-[#0b1326] border ${zone.border}`}>
              <div className={`font-bold text-sm ${zone.title}`}>{zone.network}</div>
              <div className="text-[#8b949e] mt-1">{t(`docs.architecture.zones.${zone.id}.desc`)}</div>
              <div className={`mt-3 text-[11px] ${zone.note}`}>{t(`docs.architecture.zones.${zone.id}.note`)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
