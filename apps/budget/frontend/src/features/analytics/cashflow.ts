import { Plan, Pot, Transaction } from "@/features/budget/types";

export interface Cashflow {
  totalIncome: number;
  totalAllocatedPlans: number;
  totalPotsContribution: number;
  unassignedSurplus: number;
  /** True once at least one real data point (income, plan or pot) exists for the household. */
  hasData: boolean;
}

/**
 * Real cashflow aggregates for the Sankey view: the sum of income transactions, of active plan
 * budgets and of pot monthly contributions, and the true unassigned surplus left over. There are
 * no hardcoded or demo numbers -- see issue #537.
 */
export function computeCashflow(transactions: Transaction[], plans: Plan[], pots: Pot[]): Cashflow {
  const totalIncome = transactions
    .filter((tx) => tx.transaction_type === "INCOME")
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalAllocatedPlans = plans
    .filter((p) => p.is_active)
    .reduce((sum, p) => sum + (p.total_budget || 0), 0);
  const totalPotsContribution = pots.reduce((sum, p) => sum + (p.monthly_contribution || 0), 0);
  const unassignedSurplus = Math.max(0, totalIncome - totalAllocatedPlans - totalPotsContribution);
  const hasData = transactions.length > 0 || plans.length > 0 || pots.length > 0;
  return { totalIncome, totalAllocatedPlans, totalPotsContribution, unassignedSurplus, hasData };
}
