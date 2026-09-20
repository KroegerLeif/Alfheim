"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import * as api from "@/lib/api";
import type { CreateModelBlockRequest, DiscoverModelsRequest, UpdateModelBlockRequest } from "../types";

export function useModelBlocks() {
  const { householdId, status } = useActiveHousehold();
  return useQuery({
    queryKey: ["chat", "model-blocks", { householdId }],
    queryFn: api.listModelBlocks,
    enabled: status === "ready",
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

export function useDiscoverModels() {
  return useMutation({
    mutationFn: (payload: DiscoverModelsRequest) => api.discoverModels(payload),
  });
}
