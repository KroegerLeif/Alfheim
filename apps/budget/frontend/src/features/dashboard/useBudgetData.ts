"use client";

import { useState, useEffect, useCallback } from "react";
import { accountsApi } from "@/features/accounts";
import { potsApi } from "@/features/pots";
import { plansApi } from "@/features/plans";
import { transactionsApi } from "@/features/transactions";
import {
  Account,
  NetWorthResponse,
  Pot,
  Plan,
  PlanSummaryResponse,
  Transaction,
} from "@/features/budget/types";

export function useBudgetData(planningMode: "monthly" | "event") {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthResponse | null>(null);
  const [pots, setPots] = useState<Pot[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planSummary, setPlanSummary] = useState<PlanSummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accsRes, nwRes, potsRes, plansRes, txsRes] = await Promise.all([
        accountsApi.listAccounts().catch(() => []),
        accountsApi.getNetWorth().catch(() => null),
        potsApi.listPots().catch(() => []),
        plansApi.listPlans().catch(() => []),
        transactionsApi.listTransactions().catch(() => []),
      ]);

      setAccounts(accsRes);
      setNetWorth(nwRes);
      setPots(potsRes);
      setPlans(plansRes);
      setTransactions(txsRes);

      const targetPlan = plansRes.find(
        (p: Plan) => p.plan_type === (planningMode === "monthly" ? "MONTHLY" : "EVENT") && p.is_active
      ) || plansRes[0];

      if (targetPlan) {
        const sum = await plansApi.getPlanSummary(targetPlan.id).catch(() => null);
        setPlanSummary(sum);
      } else {
        setPlanSummary(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load budget data.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [planningMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activePlan = plans.find(
    (p: Plan) => p.plan_type === (planningMode === "monthly" ? "MONTHLY" : "EVENT") && p.is_active
  ) || plans[0] || null;

  return {
    accounts,
    netWorth,
    pots,
    plans,
    activePlan,
    planSummary,
    transactions,
    loading,
    error,
    reload: loadData,
  };
}
