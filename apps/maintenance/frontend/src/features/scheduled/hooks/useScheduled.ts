import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTaskState } from "../api/scheduledApi";
import { TaskStateUpdatePayload } from "@/shared/types";

export function useUpdateTaskState(stepId: number, onSuccessCallback?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskStateUpdatePayload) => updateTaskState(stepId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    },
  });
}
