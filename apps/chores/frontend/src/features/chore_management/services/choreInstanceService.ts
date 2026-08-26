import { useMutation, useQueryClient } from "@tanstack/react-query";
import { choresClient } from "@/core/api";
import { ChoreInstanceRead } from "../types";
import { choreKeys, useActiveHouseholdId } from "./choresService";

export function useAssignChoreInstance() {
  const queryClient = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();

  return useMutation<ChoreInstanceRead, Error, { id: string; assignedTo: string | null; dueDate?: string }, any>({
    mutationFn: ({ id, assignedTo }) =>
      choresClient
        .post(`instances/${id}/assign`, { json: { assigned_to: assignedTo } })
        .json<ChoreInstanceRead>(),
    onMutate: async ({ id, assignedTo, dueDate }) => {
      await queryClient.cancelQueries({ queryKey: ["chores"] });

      const key = choreKeys.today(activeHouseholdId, dueDate);
      const prevInstances = queryClient.getQueryData<ChoreInstanceRead[]>(key);

      if (prevInstances) {
        queryClient.setQueryData<ChoreInstanceRead[]>(
          key,
          prevInstances.map((inst) =>
            inst.id === id ? { ...inst, assigned_to: assignedTo } : inst
          )
        );
      }

      return { prevInstances, key };
    },
    onError: (err, variables, context) => {
      if (context?.prevInstances) {
        queryClient.setQueryData(context.key, context.prevInstances);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
    },
  });
}

export function useCompleteChoreInstance() {
  const queryClient = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();

  return useMutation<ChoreInstanceRead, Error, { id: string; dueDate?: string }, any>({
    mutationFn: ({ id }) =>
      choresClient
        .post(`instances/${id}/complete`)
        .json<ChoreInstanceRead>(),
    onMutate: async ({ id, dueDate }) => {
      await queryClient.cancelQueries({ queryKey: ["chores"] });

      const key = choreKeys.today(activeHouseholdId, dueDate);
      const prevInstances = queryClient.getQueryData<ChoreInstanceRead[]>(key);

      if (prevInstances) {
        queryClient.setQueryData<ChoreInstanceRead[]>(
          key,
          prevInstances.map((inst) =>
            inst.id === id ? { ...inst, status: "completed" } : inst
          )
        );
      }

      return { prevInstances, key };
    },
    onError: (err, variables, context) => {
      if (context?.prevInstances) {
        queryClient.setQueryData(context.key, context.prevInstances);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
    },
  });
}
