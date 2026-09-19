import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { getDevices, createDevice } from "../api/devicesApi";
import { CreateDevicePayload, Household } from "@/shared/types";

/** The caller's households from the shared HouseholdProvider (core/household). */
export function useHouseholds(): { data: Household[]; isError: boolean } {
  const { households, status } = useActiveHousehold();
  return { data: households, isError: status === "error" };
}

export function useDevices() {
  const { householdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["devices", { householdId }],
    queryFn: getDevices,
    enabled: status === "ready",
  });
}

export function useCreateDevice(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, householdId }: { payload: CreateDevicePayload; householdId?: string | null }) =>
      createDevice(payload, householdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    },
  });
}
