import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { getHouseholds, getDevices, createDevice } from "../api/devicesApi";
import { CreateDevicePayload } from "@/shared/types";

export function useHouseholds() {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["households", { activeHouseholdId }],
    queryFn: getHouseholds,
    enabled: status === "ready",
  });
}

export function useDevices(householdId?: number | null) {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["devices", { activeHouseholdId }, householdId],
    queryFn: () => getDevices(householdId),
    enabled: status === "ready",
  });
}

export function useCreateDevice(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDevicePayload) => createDevice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    },
  });
}
