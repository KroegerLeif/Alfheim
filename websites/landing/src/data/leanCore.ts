/**
 * Lean Core facts shown on the landing page.
 *
 * Mirrors the hardware tiers table in docs/en/how-to/homelab-deployment.md
 * ("Hardware Specifications"), which is the source of truth, and the Lean Core app set of
 * ADR 0007. Change the doc first, then these values; the landing page links to the doc.
 */

/** A service that always runs, whatever optional modules are enabled. */
export interface CoreService {
  /** Translation key under `docs.leanCore.services`. */
  id: 'caddy' | 'postgres' | 'zitadel' | 'rustfs' | 'dashboard' | 'household';
  /** Product name, shown verbatim. */
  name: string;
}

/** The six Lean Core services, in the order the how-to lists them. */
export const LEAN_CORE_SERVICES: readonly CoreService[] = [
  { id: 'caddy', name: 'Caddy' },
  { id: 'postgres', name: 'PostgreSQL' },
  { id: 'zitadel', name: 'Zitadel' },
  { id: 'rustfs', name: 'RustFS' },
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'household', name: 'Household' },
];

/** How a host RAM figure is qualified; each kind has a `docs.leanCore.host.<kind>` string. */
export type HostRamKind = 'swap' | 'minimum' | 'recommended' | 'upToTwoApps' | 'upToFiveApps';

/** One host RAM figure of a tier, for example `2 GB` or `1 GB` of swap. */
export interface HostRam {
  size: string;
  kind?: HostRamKind;
}

/** One row of the hardware tiers table. */
export interface HardwareTier {
  /** Translation key under `docs.leanCore.tiers`. */
  id: 'leanCore' | 'leanCorePlusApps' | 'full' | 'fullTelemetry';
  /** Sum of the memory reservations in compose.prod.yaml. */
  reservedRam: string;
  /** Extra reservation per enabled app, for the tier that grows with the app count. */
  perAppRam?: string;
  hostRam: readonly HostRam[];
  cpuCores: number;
}

/** Hardware tiers, smallest first. */
export const HARDWARE_TIERS: readonly HardwareTier[] = [
  {
    id: 'leanCore',
    reservedRam: '752 MB',
    hostRam: [{ size: '2 GB' }, { size: '1 GB', kind: 'swap' }],
    cpuCores: 2,
  },
  {
    id: 'leanCorePlusApps',
    reservedRam: '752 MB',
    perAppRam: '176–288 MB',
    hostRam: [
      { size: '3 GB', kind: 'upToTwoApps' },
      { size: '4 GB', kind: 'upToFiveApps' },
    ],
    cpuCores: 2,
  },
  {
    id: 'full',
    reservedRam: '2.75 GB',
    hostRam: [{ size: '4 GB' }, { size: '2 GB', kind: 'swap' }, { size: '8 GB', kind: 'recommended' }],
    cpuCores: 4,
  },
  {
    id: 'fullTelemetry',
    reservedRam: '3.2 GB',
    hostRam: [
      { size: '6 GB', kind: 'minimum' },
      { size: '8 GB', kind: 'recommended' },
    ],
    cpuCores: 4,
  },
];
