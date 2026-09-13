"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
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

// --- Budget Query Keys ---
export const budgetKeys = {
  all: ["budget"] as const,
  accounts: () => [...budgetKeys.all, "accounts"] as const,
  netWorth: () => [...budgetKeys.all, "netWorth"] as const,
  pots: () => [...budgetKeys.all, "pots"] as const,
  plans: () => [...budgetKeys.all, "plans"] as const,
  planSummary: (planId: string) => [...budgetKeys.all, "planSummary", planId] as const,
  transactions: () => [...budgetKeys.all, "transactions"] as const,
};

export function useBudgetData(planningMode: "monthly" | "event") {
  const queryClient = useQueryClient();

  // Fetch all base data in parallel
  const accountsQuery = useQuery<Account[]>({
    queryKey: budgetKeys.accounts(),
    queryFn: () => accountsApi.listAccounts(),
  });

  const netWorthQuery = useQuery<NetWorthResponse | null>({
    queryKey: budgetKeys.netWorth(),
    queryFn: () => accountsApi.getNetWorth(),
  });

  const potsQuery = useQuery<Pot[]>({
    queryKey: budgetKeys.pots(),
    queryFn: () => potsApi.listPots(),
  });

  const plansQuery = useQuery<Plan[]>({
    queryKey: budgetKeys.plans(),
    queryFn: () => plansApi.listPlans(),
  });

  const transactionsQuery = useQuery<Transaction[]>({
    queryKey: budgetKeys.transactions(),
    queryFn: () => transactionsApi.listTransactions(),
  });

  // Find the target plan based on mode
  const plans = plansQuery.data || [];
  const targetPlan = plans.find(
    (p: Plan) => p.plan_type === (planningMode === "monthly" ? "MONTHLY" : "EVENT") && p.is_active
  ) || plans[0];

  // Fetch plan summary only when we have a target plan
  const planSummaryQuery = useQuery<PlanSummaryResponse | null>({
    queryKey: targetPlan ? budgetKeys.planSummary(targetPlan.id) : ["budget", "planSummary", null],
    queryFn: () => (targetPlan ? plansApi.getPlanSummary(targetPlan.id) : Promise.resolve(null)),
    enabled: !!targetPlan,
  });

  // Check if any query has an error
  const error =
    accountsQuery.error?.message ||
    netWorthQuery.error?.message ||
    potsQuery.error?.message ||
    plansQuery.error?.message ||
    transactionsQuery.error?.message ||
    planSummaryQuery.error?.message ||
    null;

  // Check if any query is loading
  const loading =
    accountsQuery.isPending ||
    netWorthQuery.isPending ||
    potsQuery.isPending ||
    plansQuery.isPending ||
    transactionsQuery.isPending ||
    (targetPlan ? planSummaryQuery.isPending : false);

  const activePlan = targetPlan || null;

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: budgetKeys.all });
  };

  return {
    accounts: accountsQuery.data || [],
    netWorth: netWorthQuery.data || null,
    pots: potsQuery.data || [],
    plans: plans,
    activePlan,
    planSummary: planSummaryQuery.data || null,
    transactions: transactionsQuery.data || [],
    loading,
    error,
    reload,
  };
}
