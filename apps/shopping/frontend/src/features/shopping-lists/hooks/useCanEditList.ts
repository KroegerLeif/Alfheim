import { useHouseholdCan } from "@alfheim/shared";
import type { ShoppingList } from "../types";

/**
 * Whether the caller may change `list` and its items: a Personal List belongs to its owner and
 * stays editable for every household role, shared lists need MEMBER or higher.
 */
export function useCanEditList(list: Pick<ShoppingList, "is_personal"> | null | undefined): boolean {
  const canWrite = useHouseholdCan("write");
  return canWrite || !!list?.is_personal;
}
