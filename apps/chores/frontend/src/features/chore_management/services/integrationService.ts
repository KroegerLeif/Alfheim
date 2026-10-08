import { useQuery } from "@tanstack/react-query";
import {
  resolveFrontendUrl,
  LEGACY_ACCESS_TOKEN_KEY,
  householdHeaders,
  useActiveHousehold,
} from "@alfheim/shared";

/**
 * Browser paths of the other apps' APIs. Caddy's bare `/api/v1/<app>*` rules strip the prefix and
 * leave a suffix that no backend serves (`/api/v1/shopping-lists` becomes `/api/v1-lists`), so the
 * apps are reached through their own `/<app>/api/v1` ingress prefix, like their frontends do.
 */
export const SHOPPING_LISTS_PATH = "/shopping/api/v1/shopping-lists";
export const MAINTENANCE_SUMMARY_PATH = "/maintenance/api/v1/maintenance/summary";

const getApiUrl = (path: string) => {
  if (typeof window !== "undefined") {
    return window.location.origin + path;
  }
  return resolveFrontendUrl() + path;
};

export interface ShoppingIntegrationData {
  pendingCount: number;
  totalLists: number;
}

export interface MaintenanceIntegrationData {
  dueCount: number;
  totalDevices: number;
}

export function useShoppingIntegration() {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();

  return useQuery<ShoppingIntegrationData>({
    queryKey: ["integrations", "shopping", activeHouseholdId],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      Object.assign(headers, householdHeaders(activeHouseholdId));

      const url = getApiUrl(SHOPPING_LISTS_PATH);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error("Failed to fetch shopping lists");
      }
      const data = await res.json();

      let pendingCount = 0;
      let totalLists = 0;
      if (Array.isArray(data)) {
        totalLists = data.length;
        for (const list of data) {
          if (Array.isArray(list.items)) {
            pendingCount += list.items.filter((item: Record<string, unknown>) => !item.is_completed).length;
          }
        }
      }
      return { pendingCount, totalLists };
    },
    staleTime: 30000,
    enabled: status === "ready",
  });
}

export function useMaintenanceIntegration() {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();

  return useQuery<MaintenanceIntegrationData>({
    queryKey: ["integrations", "maintenance", activeHouseholdId],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      Object.assign(headers, householdHeaders(activeHouseholdId));

      const url = getApiUrl(MAINTENANCE_SUMMARY_PATH);
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error("Failed to fetch maintenance summary");
      }
      const data = await res.json();

      let dueCount = 0;
      let totalDevices = 0;
      if (Array.isArray(data)) {
        for (const summary of data) {
          totalDevices += summary.total_devices || 0;
          dueCount += (summary.total_overdue || 0) + (summary.total_due_soon || 0);
        }
      }
      return { dueCount, totalDevices };
    },
    staleTime: 30000,
    enabled: status === "ready",
  });
}
