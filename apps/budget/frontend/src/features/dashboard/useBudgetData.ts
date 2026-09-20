"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
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
  household: (householdId: string | null) => [...budgetKeys.all, { householdId }] as const,
  accounts: (householdId: string | null) => [...budgetKeys.household(householdId), "accounts"] as const,
  netWorth: (householdId: string | null) => [...budgetKeys.household(householdId), "netWorth"] as const,
  pots: (householdId: string | null) => [...budgetKeys.household(householdId), "pots"] as const,
  plans: (householdId: string | null) => [...budgetKeys.household(householdId), "plans"] as const,
  planSummary: (householdId: string | null, planId: string | null) =>
    [...budgetKeys.household(householdId), "planSummary", planId] as const,
  transactions: (householdId: string | null) => [...budgetKeys.household(householdId), "transactions"] as const,
};

export function useBudgetData(planningMode: "monthly" | "event") {
  const queryClient = useQueryClient();
  const { householdId, status } = useActiveHousehold();
  const ready = status === "ready";

  // Fetch all base data in parallel
  const accountsQuery = useQuery<Account[]>({
    queryKey: budgetKeys.accounts(householdId),
    queryFn: () => accountsApi.listAccounts(),
    enabled: ready,
  });

  const netWorthQuery = useQuery<NetWorthResponse | null>({
    queryKey: budgetKeys.netWorth(householdId),
    queryFn: () => accountsApi.getNetWorth(),
    enabled: ready,
  });

  const potsQuery = useQuery<Pot[]>({
    queryKey: budgetKeys.pots(householdId),
    queryFn: () => potsApi.listPots(),
    enabled: ready,
  });

  const plansQuery = useQuery<Plan[]>({
    queryKey: budgetKeys.plans(householdId),
    queryFn: () => plansApi.listPlans(),
    enabled: ready,
  });

  const transactionsQuery = useQuery<Transaction[]>({
    queryKey: budgetKeys.transactions(householdId),
    queryFn: () => transactionsApi.listTransactions(),
    enabled: ready,
  });

  // Find the target plan based on mode
  const plans = plansQuery.data || [];
  const targetPlan = plans.find(
    (p: Plan) => p.plan_type === (planningMode === "monthly" ? "MONTHLY" : "EVENT") && p.is_active
  ) || plans[0];

  // Fetch plan summary only when we have a target plan
  const planSummaryQuery = useQuery<PlanSummaryResponse | null>({
    queryKey: budgetKeys.planSummary(householdId, targetPlan?.id ?? null),
    queryFn: () => (targetPlan ? plansApi.getPlanSummary(targetPlan.id) : Promise.resolve(null)),
    enabled: ready && !!targetPlan,
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
