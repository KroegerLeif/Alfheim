import { useHouseholdCan, useHouseholdPermission } from "@alfheim/shared";

type WritableScope = "household" | "user";

/**
 * Household role rules of the shared equipment and exercise catalogs: `user` entries are
 * personal and open to every role, `household` entries need MEMBER or higher to create and
 * ADMIN or OWNER to delete.
 */
export function useCatalogScopes(): WritableScope[] {
  return useHouseholdCan("write") ? ["household", "user"] : ["user"];
}

export interface CatalogDeleteState {
  /** Whether a delete control is shown at all (hidden for guests on household entries). */
  visible: boolean;
  allowed: boolean;
  hint: string | undefined;
}

export function useCatalogDelete(scope: string): CatalogDeleteState {
  const canWrite = useHouseholdCan("write");
  const remove = useHouseholdPermission("adminDelete");
  if (scope !== "household") return { visible: true, allowed: true, hint: undefined };
  return { visible: canWrite, allowed: remove.allowed, hint: remove.hint };
}
