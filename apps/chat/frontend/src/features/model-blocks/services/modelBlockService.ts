"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { CreateModelBlockRequest, UpdateModelBlockRequest } from "../types";

export function useModelBlocks() {
  return useQuery({
    queryKey: ["chat", "model-blocks"],
    queryFn: api.listModelBlocks,
  });
}

export function useCreateModelBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateModelBlockRequest) => api.createModelBlock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "model-blocks"] });
    },
  });
}

export function useUpdateModelBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateModelBlockRequest }) =>
      api.updateModelBlock(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "model-blocks"] });
    },
  });
}

export function useDeleteModelBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteModelBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "model-blocks"] });
    },
  });
}

export function useTriggerHealthCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.triggerModelBlockHealthCheck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", "model-blocks"] });
    },
  });
}
