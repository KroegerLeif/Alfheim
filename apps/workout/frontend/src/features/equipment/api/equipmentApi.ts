import { workoutClient } from "@/core/api";
import type {
  EquipmentCreate,
  EquipmentListParams,
  EquipmentRead,
  EquipmentUpdate,
} from "../types";

const RESOURCE = "api/v1/equipment";

/**
 * Raw HTTP calls for the equipment resource.
 *
 * This layer holds no caching or React state — TanStack Query wrappers live in
 * ../hooks. Tenant headers are attached centrally by the ky client.
 */
export const equipmentApi = {
  list(params: EquipmentListParams = {}): Promise<EquipmentRead[]> {
    const searchParams: Record<string, string | number | boolean> = {};
    if (params.is_active !== undefined) searchParams.is_active = params.is_active;
    if (params.limit !== undefined) searchParams.limit = params.limit;
    if (params.offset !== undefined) searchParams.offset = params.offset;

    return workoutClient.get(RESOURCE, { searchParams }).json<EquipmentRead[]>();
  },

  get(id: string): Promise<EquipmentRead> {
    return workoutClient.get(`${RESOURCE}/${id}`).json<EquipmentRead>();
  },

  create(payload: EquipmentCreate): Promise<EquipmentRead> {
    return workoutClient.post(RESOURCE, { json: payload }).json<EquipmentRead>();
  },

  update(id: string, payload: EquipmentUpdate): Promise<EquipmentRead> {
    return workoutClient.patch(`${RESOURCE}/${id}`, { json: payload }).json<EquipmentRead>();
  },

  async remove(id: string): Promise<void> {
    // The endpoint returns 204 with an empty body, so the response is not parsed.
    await workoutClient.delete(`${RESOURCE}/${id}`);
  },
};
