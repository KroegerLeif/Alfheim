import { useQuery } from "@tanstack/react-query";
import { useActiveHouseholdId } from "./choresService";

const getApiUrl = (path: string) => {
  if (typeof window !== "undefined") {
    return window.location.origin + path;
  }
  return "http://alfheim" + path;
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
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<ShoppingIntegrationData>({
    queryKey: ["integrations", "shopping", activeHouseholdId],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token_chores-frontend") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (activeHouseholdId) headers["X-Household-ID"] = activeHouseholdId;

      const url = getApiUrl("/api/v1/shopping-lists");
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
            pendingCount += list.items.filter((item: any) => !item.is_completed).length;
          }
        }
      }
      return { pendingCount, totalLists };
    },
    staleTime: 30000,
  });
}

export function useMaintenanceIntegration() {
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<MaintenanceIntegrationData>({
    queryKey: ["integrations", "maintenance", activeHouseholdId],
    queryFn: async () => {
      const token = typeof window !== "undefined" ? sessionStorage.getItem("token_chores-frontend") : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (activeHouseholdId) headers["X-Household-ID"] = activeHouseholdId;

      const url = getApiUrl("/api/v1/maintenance/summary");
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
  });
}
