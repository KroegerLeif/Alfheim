import { useCallback, useState } from "react";
import { lendingApi } from "../api/lendingApi";
import { LendItemPayload } from "../types";

/** Fields of a catalog item the lending actions need. */
interface LendableItem {
  id: string;
  title: string;
}

/**
 * Lend and return actions for catalog cards (#551). Holds the item whose lend dialog is
 * open and reloads the catalog through `onChanged` after a successful lend or return, so the
 * card shows the new status. A failed return is reported in `returnError`; a failed lend is
 * rethrown so the dialog stays open with its own error message.
 */
export function useCatalogLending(onChanged: () => unknown) {
  const [lendingItem, setLendingItem] = useState<LendableItem | null>(null);
  const [returnError, setReturnError] = useState(false);

  const openLendDialog = useCallback((item: LendableItem) => {
    setReturnError(false);
    setLendingItem(item);
  }, []);

  const closeLendDialog = useCallback(() => setLendingItem(null), []);

  const submitLend = useCallback(
    async (payload: LendItemPayload) => {
      if (!lendingItem) return;
      await lendingApi.lendItem(lendingItem.id, payload);
      await onChanged();
    },
    [lendingItem, onChanged]
  );

  const returnItem = useCallback(
    async (item: LendableItem) => {
      setReturnError(false);
      try {
        await lendingApi.returnItem(item.id);
        await onChanged();
      } catch {
        setReturnError(true);
      }
    },
    [onChanged]
  );

  return { lendingItem, openLendDialog, closeLendDialog, submitLend, returnItem, returnError };
}
