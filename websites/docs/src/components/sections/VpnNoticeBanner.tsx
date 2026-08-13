import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { ShieldAlert, Lock, Network } from 'lucide-react';

export const VpnNoticeBanner: React.FC = () => {
  const { t } = useDocTranslation();

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <div className="glass-card rounded-2xl p-4 sm:p-6 border border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-[#111b33]/80 to-indigo-950/40 specular-border shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-2.5 sm:p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-[#3eb1ff] shrink-0 mt-0.5 sm:mt-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-sky-500/20 text-[#3eb1ff] border border-sky-500/30 font-semibold">
                  {t('docs.vpnNotice.badge', 'Security Perimeter')}
                </span>
                <span className="text-xs text-[#8b949e] font-mono flex items-center gap-1">
                  <Lock className="w-3 h-3 text-sky-400" />
                  WireGuard / Tailscale Enclave
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-[#f0f6fc] mt-1">
                {t('docs.vpnNotice.title', 'Private Network Access Notice')}
              </h3>
              <p className="text-sm text-[#8b949e] mt-1 leading-relaxed max-w-3xl">
                {t(
                  'docs.vpnNotice.description',
                  'Production apps (Dashboard, Pantry, Shopping, Chores, Maintenance) run within an isolated WireGuard/Tailscale enclave. Direct access to live instances requires active VPN tunnel authorization.'
                )}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex sm:flex-col items-end gap-1.5 text-right w-full sm:w-auto border-t sm:border-t-0 border-[#1c2847] pt-3 sm:pt-0">
            <span className="text-[11px] font-mono text-[#8b949e] flex items-center gap-1">
              <Network className="w-3.5 h-3.5 text-[#3eb1ff]" />
              Caddy Ingress Gateway
            </span>
            <span className="text-xs font-mono text-[#3eb1ff]">api.alfheim.loegien.de</span>
          </div>
        </div>
      </div>
    </div>
  );
};
