"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { CreateConversationRequest } from "@/features/conversations/types";

export function useModelBlocks() {
  return useQuery({
    queryKey: ["chat", "model-blocks"],
    queryFn: api.listModelBlocks,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: api.listConversations,
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
  return useQuery({
    queryKey: ["chat", "conversations", conversationId, "messages"],
    queryFn: () => api.listMessages(conversationId as string),
    enabled: !!conversationId,
  });
}
