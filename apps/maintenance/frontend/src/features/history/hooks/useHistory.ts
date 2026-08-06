import { useQuery } from "@tanstack/react-query";
import { getServiceHistory } from "../api/historyApi";

export function useServiceHistory(householdId?: number | null) {
  return useQuery({
    queryKey: ["serviceHistory", householdId],
    queryFn: () => getServiceHistory(householdId),
  });
}
