import { useCallback, useEffect, useState } from "react";
import { lendingApi } from "../api/lendingApi";
import {
  LendingRecord,
  LendItemPayload,
  ReturnItemPayload,
} from "../types";

export function useLending() {
  const [history, setHistory] = useState<LendingRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await lendingApi.getLendingHistory({ limit: 100 });
      setHistory(data.records);
      setTotal(data.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load lending history";
      setError(msg);
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
        const msg = err instanceof Error ? err.message : "Failed to lend item";
        setError(msg);
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
        const msg = err instanceof Error ? err.message : "Failed to return item";
        setError(msg);
        throw err;
      }
    },
    [fetchHistory]
  );

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await lendingApi.getLendingHistory({ limit: 100 });
        if (!ignore) {
          setHistory(data.records);
          setTotal(data.total);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Failed to load lending history";
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const activeLoans = history.filter((rec) => rec.status === "LENT_OUT");

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
