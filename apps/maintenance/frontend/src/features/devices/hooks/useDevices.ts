import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getHouseholds, getDevices, createDevice } from "../api/devicesApi";
import { CreateDevicePayload } from "@/shared/types";

export function useHouseholds() {
  return useQuery({
    queryKey: ["households"],
    queryFn: getHouseholds,
  });
}

export function useDevices(householdId?: number | null) {
  return useQuery({
    queryKey: ["devices", householdId],
    queryFn: () => getDevices(householdId),
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
