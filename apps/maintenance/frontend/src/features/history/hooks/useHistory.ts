import { useQuery } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { getServiceHistory } from "../api/historyApi";

export function useServiceHistory(householdId?: number | null) {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["serviceHistory", { activeHouseholdId }, householdId],
    queryFn: () => getServiceHistory(householdId),
    enabled: status === "ready",
  });
}
