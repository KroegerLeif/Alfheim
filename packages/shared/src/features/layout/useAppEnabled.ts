'use client';

import { useEffect, useState } from 'react';
import { getResolvedToken } from './ChatWidget/sseClient';

/** Dashboard endpoint listing the Tier-1 apps the installation runs (`ALFHEIM_ENABLED_APPS`). */
export const ENABLED_APPS_PATH = '/api/v1/apps/enabled';

/** Response body of {@link ENABLED_APPS_PATH}. */
interface EnabledAppsResponse {
  apps: string[];
}

/**
 * One request per page load: the enabled set only changes when the stack is reconfigured
 * and restarted. Resolves to null when the list cannot be read, so callers keep their
 * entry points and let the app itself report that it is unavailable.
 */
let enabledAppsRequest: Promise<ReadonlySet<string> | null> | null = null;

async function loadEnabledApps(): Promise<ReadonlySet<string> | null> {
  const token = getResolvedToken();
  try {
    const res = await fetch(ENABLED_APPS_PATH, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      console.warn(`Enabled apps could not be loaded (HTTP ${res.status}); keeping app entry points.`);
      return null;
    }
    const body: EnabledAppsResponse = await res.json();
    return new Set((body.apps ?? []).map((id) => id.toLowerCase()));
  } catch (error) {
    console.warn('Enabled apps could not be loaded; keeping app entry points.', error);
    return null;
  }
}

/** The cached enabled-apps request, started on first use. */
export function fetchEnabledApps(): Promise<ReadonlySet<string> | null> {
  if (!enabledAppsRequest) {
    enabledAppsRequest = loadEnabledApps().then((apps) => {
      // A failed read is retried on the next mount instead of hiding entry points for good.
      if (apps === null) enabledAppsRequest = null;
      return apps;
    });
  }
  return enabledAppsRequest;
}

/** Clears the cached enabled-apps request. For tests only. */
export function resetEnabledAppsCache(): void {
  enabledAppsRequest = null;
}

/**
 * Whether the optional app `appId` is installed, from the dashboard's enabled-apps list.
 *
 * Returns `undefined` while the list loads and `true` when it cannot be read, so a stopped
 * dashboard never hides a working feature. Only an explicit list without `appId` yields
 * `false`. It never probes the app's own backend: an installed but stopped app stays `true`
 * and reports its outage itself (#917).
 */
export function useAppEnabled(appId: string): boolean | undefined {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetchEnabledApps().then((apps) => {
      if (active) setEnabled(apps === null || apps.has(appId.toLowerCase()));
    });
    return () => {
      active = false;
    };
  }, [appId]);

  return enabled;
}
