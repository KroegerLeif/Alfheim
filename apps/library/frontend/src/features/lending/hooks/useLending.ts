import { useCallback, useEffect, useState } from "react";
import { lendingApi } from "../api/lendingApi";
import {
  LendingRecord,
  LendItemPayload,
  ReturnItemPayload,
} from "../types";

/** What failed last; the UI maps it to a localized message. */
export type LendingErrorKind = "load" | "lend" | "return";

/** Records requested for the lending overview. */
export const LENDING_HISTORY_LIMIT = 100;

export function useLending() {
  const [history, setHistory] = useState<LendingRecord[]>([]);
  const [activeLoans, setActiveLoans] = useState<LendingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<LendingErrorKind | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      // Active loans are fetched on their own so an old, still open loan is never pushed out of
      // the capped history page.
      const [all, active] = await Promise.all([
        lendingApi.getLendingHistory({ limit: LENDING_HISTORY_LIMIT }),
        lendingApi.getLendingHistory({ status: "LENT_OUT", limit: LENDING_HISTORY_LIMIT }),
      ]);
      setHistory(all.records ?? []);
      setActiveLoans(active.records ?? []);
      setTotal(all.total);
      setError(null);
    } catch {
      setError("load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const lendItem = useCallback(
    async (itemId: string, payload: LendItemPayload) => {
      setError(null);
      try {
        const record = await lendingApi.lendItem(itemId, payload);
        await fetchHistory();
        return record;
      } catch (err: unknown) {
        setError("lend");
        throw err;
      }
    },
    [fetchHistory]
  );

  const returnItem = useCallback(
    async (itemId: string, payload?: ReturnItemPayload) => {
      setError(null);
      try {
        const record = await lendingApi.returnItem(itemId, payload);
        await fetchHistory();
        return record;
      } catch (err: unknown) {
        setError("return");
        throw err;
      }
    },
    [fetchHistory]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    activeLoans,
    total,
    isLoading,
    error,
    fetchHistory,
    lendItem,
    returnItem,
  };
}
