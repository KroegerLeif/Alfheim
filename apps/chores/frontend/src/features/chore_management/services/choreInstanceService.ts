import { useMutation, useQueryClient } from "@tanstack/react-query";
import { choresClient } from "@/core/api";
import { ChoreInstanceRead } from "../types";
import { useActiveHousehold } from "@alfheim/shared";
import { choreKeys } from "./choresService";

export function useAssignChoreInstance() {
  const queryClient = useQueryClient();
  const { householdId: activeHouseholdId } = useActiveHousehold();

  return useMutation<ChoreInstanceRead, Error, { id: string; assignedTo: string | null; dueDate?: string }, { prevInstances?: ChoreInstanceRead[]; key: readonly unknown[] }>({
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

/**
 * Toggle self-assignment ("Claim" / release) on a chore instance.
 *
 * The assignee is always derived server-side from the authenticated caller --
 * this never sends a user id in the request body, so a client can neither
 * spoof nor be defaulted to a hardcoded id.
 */
export function useClaimChoreInstance() {
  const queryClient = useQueryClient();
  const { householdId: activeHouseholdId } = useActiveHousehold();

  return useMutation<ChoreInstanceRead, Error, { id: string; isClaimed: boolean; dueDate?: string }, { prevInstances?: ChoreInstanceRead[]; key: readonly unknown[] }>({
    mutationFn: ({ id }) =>
      choresClient
        .post(`instances/${id}/claim`)
        .json<ChoreInstanceRead>(),
    onMutate: async ({ id, isClaimed, dueDate }) => {
      await queryClient.cancelQueries({ queryKey: ["chores"] });

      const key = choreKeys.today(activeHouseholdId, dueDate);
      const prevInstances = queryClient.getQueryData<ChoreInstanceRead[]>(key);

      if (prevInstances) {
        queryClient.setQueryData<ChoreInstanceRead[]>(
          key,
          prevInstances.map((inst) =>
            // Optimistic placeholder only -- never sent to the server, and
            // replaced by the real assignee once the mutation settles.
            inst.id === id ? { ...inst, assigned_to: isClaimed ? null : "__pending_self_claim__" } : inst
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
  const { householdId: activeHouseholdId } = useActiveHousehold();

  return useMutation<ChoreInstanceRead, Error, { id: string; dueDate?: string }, { prevInstances?: ChoreInstanceRead[]; key: readonly unknown[] }>({
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
