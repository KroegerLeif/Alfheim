import { useQuery } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { getServiceHistory } from "../api/historyApi";

export function useServiceHistory() {
  const { householdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["serviceHistory", { householdId }],
    queryFn: getServiceHistory,
    enabled: status === "ready",
  });
}
