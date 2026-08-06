import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { choresClient } from "@/core/api";
import { 
  ChoreTemplateRead, 
  ChoreTemplateCreate, 
  ChoreTemplateUpdate, 
  ChoreInstanceRead, 
  ChoreIntegrationSummary 
} from "../types";
import { useState, useEffect } from "react";

export function useActiveHouseholdId() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(localStorage.getItem("loeger_os_active_household_id"));

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "loeger_os_active_household_id") {
        setActiveId(e.newValue);
      }
    };

    const handleLocalChange = () => {
      setActiveId(localStorage.getItem("loeger_os_active_household_id"));
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("storage-household-changed", handleLocalChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("storage-household-changed", handleLocalChange);
    };
  }, []);

  return activeId;
}

export const choreKeys = {
  all: (householdId: string | null) => ["chores", { householdId }] as const,
  templates: (householdId: string | null) => [...choreKeys.all(householdId), "templates"] as const,
  today: (householdId: string | null, dueDate?: string) => [...choreKeys.all(householdId), "today", { dueDate }] as const,
  summary: (householdId: string | null) => [...choreKeys.all(householdId), "summary"] as const,
};

export function useChoreTemplates() {
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<ChoreTemplateRead[]>({
    queryKey: choreKeys.templates(activeHouseholdId),
    queryFn: () => 
      choresClient
        .get("api/v1/chores/templates")
        .json<ChoreTemplateRead[]>(),
  });
}

export function useTodayChores(dueDate?: string) {
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<ChoreInstanceRead[]>({
    queryKey: choreKeys.today(activeHouseholdId, dueDate),
    queryFn: () => 
      choresClient
        .get("api/v1/chores/today", {
          searchParams: dueDate ? { due_date: dueDate } : {},
        })
        .json<ChoreInstanceRead[]>(),
  });
}

export function useChoreSummary() {
  const activeHouseholdId = useActiveHouseholdId();

  return useQuery<ChoreIntegrationSummary>({
    queryKey: choreKeys.summary(activeHouseholdId),
    queryFn: () => 
      choresClient
        .get("api/v1/chores/integrations/summary")
        .json<ChoreIntegrationSummary>(),
  });
}

export function useCreateChoreTemplate() {
  const queryClient = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();

  return useMutation<ChoreTemplateRead, Error, ChoreTemplateCreate>({
    mutationFn: (payload) =>
      choresClient
        .post("api/v1/chores/templates", { json: payload })
        .json<ChoreTemplateRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.templates(activeHouseholdId) });
    },
  });
}

export function useAssignChoreInstance() {
  const queryClient = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();

  return useMutation<ChoreInstanceRead, Error, { id: string; assignedTo: string | null; dueDate?: string }, any>({
    mutationFn: ({ id, assignedTo }) =>
      choresClient
        .post(`api/v1/chores/instances/${id}/assign`, { json: { assigned_to: assignedTo } })
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
        .post(`api/v1/chores/instances/${id}/complete`)
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

export function useDeleteChoreTemplate() {
  const queryClient = useQueryClient();
  const activeHouseholdId = useActiveHouseholdId();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      choresClient
        .delete(`api/v1/chores/templates/${id}`)
        .json<void>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.templates(activeHouseholdId) });
      queryClient.invalidateQueries({ queryKey: ["chores", "today"] });
    },
  });
}
