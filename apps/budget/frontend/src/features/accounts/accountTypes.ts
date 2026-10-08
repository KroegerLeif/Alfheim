import { AccountType } from "@/features/budget/types";

/** Translation keys for the account types the backend can return. */
export const ACCOUNT_TYPE_KEYS: Record<AccountType, string> = {
  CHECKING: "budget.accounts.checking",
  SAVINGS: "budget.accounts.savings",
  INVESTMENT: "budget.accounts.investment",
  BUILDING_SAVINGS: "budget.accounts.buildingSavings",
};

/** Resolves the translated account type, falling back to a readable form of an unknown value. */
export function accountTypeLabel(type: string, t: (key: string) => string): string {
  const key = (ACCOUNT_TYPE_KEYS as Record<string, string | undefined>)[type];
  return key ? t(key) : type.replace(/_/g, " ").toLowerCase();
}
