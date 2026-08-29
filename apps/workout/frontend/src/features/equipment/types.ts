/** Mirrors `EquipmentScope` in apps/workout/backend/src/features/equipment/models.py. */
export type EquipmentScope = "system" | "household" | "user";

/** Mirrors `EquipmentRead`. */
export interface EquipmentRead {
  id: string;
  scope: EquipmentScope;
  home_id: string | null;
  owner_user_id: string | null;
  name: string;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Mirrors `EquipmentCreate`. The backend rejects a `system` scope from the API. */
export interface EquipmentCreate {
  name: string;
  category?: string | null;
  scope?: Exclude<EquipmentScope, "system">;
}

/** Mirrors `EquipmentUpdate`. */
export interface EquipmentUpdate {
  name?: string;
  category?: string | null;
  is_active?: boolean;
}

export interface EquipmentListParams {
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

/** System entries are seeded server-side and are read-only through the API. */
export function isEditableEquipment(equipment: EquipmentRead): boolean {
  return equipment.scope !== "system";
}
