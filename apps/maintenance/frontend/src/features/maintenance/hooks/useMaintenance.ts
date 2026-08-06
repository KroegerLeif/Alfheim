import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitMaintenance } from "../api/maintenanceApi";
import { MaintenanceSubmitPayload } from "@/shared/types";

export function useSubmitMaintenance(onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MaintenanceSubmitPayload) => submitMaintenance(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    },
  });
}
