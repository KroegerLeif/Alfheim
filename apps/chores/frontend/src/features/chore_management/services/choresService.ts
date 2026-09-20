import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { choresClient } from "@/core/api";
import {
  ChoreTemplateRead,
  ChoreTemplateCreate,
  ChoreInstanceRead,
  ChoreIntegrationSummary,
  ChoreTimelineRead
} from "../types";
export * from "./choreInstanceService";

export const choreKeys = {
  all: (householdId: string | null) => ["chores", { householdId }] as const,
  templates: (householdId: string | null) => [...choreKeys.all(householdId), "templates"] as const,
  today: (householdId: string | null, dueDate?: string) => [...choreKeys.all(householdId), "today", { dueDate }] as const,
  summary: (householdId: string | null) => [...choreKeys.all(householdId), "summary"] as const,
};

export function useChoreTemplates() {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();

  return useQuery<ChoreTemplateRead[]>({
    queryKey: choreKeys.templates(activeHouseholdId),
    queryFn: () =>
      choresClient
        .get("templates")
        .json<ChoreTemplateRead[]>(),
    enabled: status === "ready",
  });
}

export function useTodayChores(dueDate?: string) {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();

  return useQuery<ChoreInstanceRead[]>({
    queryKey: choreKeys.today(activeHouseholdId, dueDate),
    queryFn: () =>
      choresClient
        .get("today", {
          searchParams: dueDate ? { due_date: dueDate } : {},
        })
        .json<ChoreInstanceRead[]>(),
    enabled: status === "ready",
  });
}

export function useChoreSummary() {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();

  return useQuery<ChoreIntegrationSummary>({
    queryKey: choreKeys.summary(activeHouseholdId),
    queryFn: () =>
      choresClient
        .get("integrations/summary")
        .json<ChoreIntegrationSummary>(),
    enabled: status === "ready",
  });
}

export function useCreateChoreTemplate() {
  const queryClient = useQueryClient();
  const { householdId: activeHouseholdId } = useActiveHousehold();

  return useMutation<ChoreTemplateRead, Error, ChoreTemplateCreate>({
    mutationFn: (payload) =>
      choresClient
        .post("templates", { json: payload })
        .json<ChoreTemplateRead>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.templates(activeHouseholdId) });
    },
  });
}

export function useDeleteChoreTemplate() {
  const queryClient = useQueryClient();
  const { householdId: activeHouseholdId } = useActiveHousehold();

  return useMutation<void, Error, string>({
    mutationFn: (id) =>
      choresClient
        .delete(`templates/${id}`)
        .json<void>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.templates(activeHouseholdId) });
      queryClient.invalidateQueries({ queryKey: ["chores", "today"] });
    },
  });
}

export function useTaskTimeline(templateId: string) {
  const { householdId: activeHouseholdId, status } = useActiveHousehold();

  return useQuery<ChoreTimelineRead[]>({
    queryKey: [...choreKeys.templates(activeHouseholdId), templateId, "timeline"],
    queryFn: () =>
      choresClient
        .get(`templates/${templateId}/timeline`)
        .json<ChoreTimelineRead[]>(),
    enabled: status === "ready" && !!templateId && !!activeHouseholdId,
  });
}
