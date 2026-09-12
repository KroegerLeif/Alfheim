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
      title: t('docs.architecture.pillars.iam.title', 'Zero-Trust IAM'),
      desc: t(
        'docs.architecture.pillars.iam.desc',
        'Centralized Keycloak OIDC authentication issuing short-lived RS256 JWT tokens verified by all microservice backends.'
      ),
    },
    {
      id: 'storage',
      icon: HardDrive,
      color: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      title: t('docs.architecture.pillars.storage.title', 'Tenant S3 Storage'),
      desc: t(
        'docs.architecture.pillars.storage.desc',
        'RustFS high-performance S3 object storage with tenant-isolated buckets and presigned PUT/GET URLs.'
      ),
    },
    {
      id: 'proxy',
      icon: Network,
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      title: t('docs.architecture.pillars.proxy.title', 'Caddy Reverse Proxy'),
      desc: t(
        'docs.architecture.pillars.proxy.desc',
        'Central ingress gateway performing path-based routing, header injection, and HTTPS certificate management.'
      ),
    },
    {
      id: 'observability',
      icon: Activity,
      color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      title: t('docs.architecture.pillars.observability.title', 'OpenTelemetry & VictoriaStack'),
      desc: t(
        'docs.architecture.pillars.observability.desc',
        'Full distributed tracing, structured logging, and real-time CPU/memory/traffic telemetry across all containers.'
      ),
    },
  ];

  return (
    <section id="architecture" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="text-xs font-mono uppercase px-3 py-1 rounded-full bg-[#111b33] border border-[#1c2847] text-[#3eb1ff]">
          {t('docs.architecture.badge', 'Topology & Security')}
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold text-[#f0f6fc] mt-3">
          {t('docs.architecture.title', 'Architectural Foundation')}
        </h2>
        <p className="text-[#8b949e] mt-3 text-base">
          {t(
            'docs.architecture.subtitle',
            'Security-first multi-zone network segmentation with unified Keycloak identity brokering.'
          )}
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
          <span>{t('docs.architecture.diagram_title', 'DOCKER MULTI-ZONE NETWORK TOPOLOGY')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-4 rounded-xl bg-[#0b1326] border border-sky-500/30">
            <div className="font-bold text-[#3eb1ff] text-sm">gateway-net</div>
            <div className="text-[#8b949e] mt-1">Caddy Ingress &amp; Frontends</div>
            <div className="mt-3 text-[11px] text-sky-400/80">Public / WireGuard Ingress</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0b1326] border border-emerald-500/30">
            <div className="font-bold text-emerald-400 text-sm">infra-net</div>
            <div className="text-[#8b949e] mt-1">Keycloak &amp; postgres-iam &amp; RustFS</div>
            <div className="mt-3 text-[11px] text-emerald-400/80">Isolated Platform IAM</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0b1326] border border-cyan-500/30">
            <div className="font-bold text-cyan-400 text-sm">core-net</div>
            <div className="text-[#8b949e] mt-1">Dashboard Backend &amp; DB</div>
            <div className="mt-3 text-[11px] text-cyan-400/80">Platform Control Plane</div>
          </div>
          <div className="p-4 rounded-xl bg-[#0b1326] border border-purple-500/30">
            <div className="font-bold text-purple-400 text-sm">app-*-net</div>
            <div className="text-[#8b949e] mt-1">8 Microservice Backends &amp; DBs</div>
            <div className="mt-3 text-[11px] text-purple-400/80">Zero Cross-App DB Coupling</div>
          </div>
        </div>
      </div>
    </section>
  );
};
