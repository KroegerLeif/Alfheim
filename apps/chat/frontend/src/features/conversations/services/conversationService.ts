"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import * as api from "@/lib/api";
import type { CreateConversationRequest } from "@/features/conversations/types";

export function useModelBlocks() {
  const { householdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["chat", "model-blocks", { householdId }],
    queryFn: api.listModelBlocks,
    enabled: status === "ready",
  });
}

export function useConversations() {
  const { householdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["chat", "conversations", { householdId }],
    queryFn: api.listConversations,
    enabled: status === "ready",
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConversationRequest) => api.createConversation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}

export function useMessages(conversationId: string | null) {
  const { householdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["chat", "conversations", conversationId, "messages", { householdId }],
    queryFn: () => api.listMessages(conversationId as string),
    enabled: status === "ready" && !!conversationId,
  });
}
