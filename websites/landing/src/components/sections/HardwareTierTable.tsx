import React from 'react';
import { useDocTranslation } from '../../i18n/useDocTranslation';
import { HARDWARE_TIERS, type HardwareTier } from '../../data/leanCore';

/** Summary of the hardware tiers; the numbers come from `data/leanCore.ts`. */
export const HardwareTierTable: React.FC = () => {
  const { t } = useDocTranslation();

  const reserved = (tier: HardwareTier): string =>
    tier.perAppRam
      ? t('docs.leanCore.reservedPerApp', { base: tier.reservedRam, perApp: tier.perAppRam })
      : tier.reservedRam;

  const host = (tier: HardwareTier): string =>
    tier.hostRam
      .map(({ size, kind }) => (kind ? t(`docs.leanCore.host.${kind}`, { size }) : size))
      .join(', ');

  return (
    <div className="glass-card rounded-2xl overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t('docs.leanCore.table.caption')}</caption>
        <thead className="text-xs font-mono uppercase text-muted border-b border-line">
          <tr>
            <th scope="col" className="px-4 py-3">{t('docs.leanCore.table.tier')}</th>
            <th scope="col" className="px-4 py-3">{t('docs.leanCore.table.reserved')}</th>
            <th scope="col" className="px-4 py-3">{t('docs.leanCore.table.host')}</th>
            <th scope="col" className="px-4 py-3">{t('docs.leanCore.table.cpu')}</th>
          </tr>
        </thead>
        <tbody>
          {HARDWARE_TIERS.map((tier) => (
            <tr key={tier.id} className="border-b border-line last:border-b-0 align-top">
              <th scope="row" className="px-4 py-3 font-semibold text-fg">
                {t(`docs.leanCore.tiers.${tier.id}.name`)}
                <span className="block text-xs font-normal text-muted mt-0.5">
                  {t(`docs.leanCore.tiers.${tier.id}.runs`)}
                </span>
              </th>
              <td className="px-4 py-3 font-mono text-fg whitespace-nowrap">{reserved(tier)}</td>
              <td className="px-4 py-3 text-fg">{host(tier)}</td>
              <td className="px-4 py-3 text-fg whitespace-nowrap">
                {t('docs.leanCore.table.cores', { count: tier.cpuCores })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
