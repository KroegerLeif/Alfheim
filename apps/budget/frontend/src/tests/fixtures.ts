import { Account, Plan, PlanCategory, Pot, Transaction } from "@/features/budget/types";

/** A single unbroken token that cannot wrap, to provoke overflow in cards and rows. */
export const LONG_NAME =
  "SupercalifragilisticexpialidociousAccountNameThatKeepsGoingAndGoingWithoutAnySpaceAtAllForOverflowChecks";

const stamp = "2025-01-01";

export const longAccount: Account = {
  id: "acc-long",
  household_id: "hh-1",
  name: LONG_NAME,
  account_type: "CHECKING",
  balance: 1234567.89,
  currency: "EUR",
  is_active: true,
  created_at: stamp,
  updated_at: stamp,
};

export const longPot: Pot = {
  id: "pot-long",
  household_id: "hh-1",
  name: LONG_NAME,
  priority: 3,
  target_amount: 5000,
  current_amount: 2500,
  monthly_contribution: 500,
  overflow_target: "INVESTMENT",
  is_active: true,
  created_at: stamp,
  updated_at: stamp,
};

export const longPlan: Plan = {
  id: "plan-long",
  household_id: "hh-1",
  name: LONG_NAME,
  description: LONG_NAME.repeat(3),
  plan_type: "EVENT",
  total_budget: 9999,
  is_active: true,
  created_at: stamp,
  updated_at: stamp,
};

export const longCategory: PlanCategory = {
  id: "cat-long",
  plan_id: "plan-long",
  household_id: "hh-1",
  name: LONG_NAME,
  allocated_amount: 100,
  created_at: stamp,
  updated_at: stamp,
  subcategories: [
    {
      id: "sub-long",
      plan_id: "plan-long",
      household_id: "hh-1",
      name: LONG_NAME,
      parent_id: "cat-long",
      allocated_amount: 10,
      created_at: stamp,
      updated_at: stamp,
    },
  ],
};

export const longTransaction: Transaction = {
  id: "tx-long",
  household_id: "hh-1",
  description: LONG_NAME,
  amount: 45.5,
  currency: "EUR",
  transaction_type: "EXPENSE",
  transaction_date: "2025-01-10",
  is_quick_add: true,
  created_at: stamp,
  updated_at: stamp,
};
