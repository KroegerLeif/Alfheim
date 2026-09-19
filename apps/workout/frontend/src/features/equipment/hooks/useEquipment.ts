"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { equipmentApi } from "../api/equipmentApi";
import type {
  EquipmentCreate,
  EquipmentListParams,
  EquipmentRead,
  EquipmentUpdate,
} from "../types";

/**
 * Query keys are scoped by household id so switching households cannot serve
 * another tenant's cached entries.
 */
export const equipmentKeys = {
  all: (householdId: string | null) => ["equipment", { householdId }] as const,
  list: (householdId: string | null, params?: EquipmentListParams) =>
    [...equipmentKeys.all(householdId), "list", params ?? {}] as const,
  detail: (householdId: string | null, id: string) =>
    [...equipmentKeys.all(householdId), "detail", id] as const,
};

export function useEquipmentList(params: EquipmentListParams = {}) {
  const { householdId, status } = useActiveHousehold();

  return useQuery<EquipmentRead[]>({
    queryKey: equipmentKeys.list(householdId, params),
    queryFn: () => equipmentApi.list(params),
    enabled: status === "ready",
  });
}

export function useEquipmentDetail(id: string) {
  const { householdId, status } = useActiveHousehold();

  return useQuery<EquipmentRead>({
    queryKey: equipmentKeys.detail(householdId, id),
    queryFn: () => equipmentApi.get(id),
    enabled: status === "ready" && Boolean(id),
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  const { householdId } = useActiveHousehold();

  return useMutation<EquipmentRead, Error, EquipmentCreate>({
    mutationFn: (payload) => equipmentApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(householdId) });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  const { householdId } = useActiveHousehold();

  return useMutation<EquipmentRead, Error, { id: string; payload: EquipmentUpdate }>({
    mutationFn: ({ id, payload }) => equipmentApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(householdId) });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  const { householdId } = useActiveHousehold();

  return useMutation<void, Error, string>({
    mutationFn: (id) => equipmentApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all(householdId) });
    },
  });
}
