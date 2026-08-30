export type AccountType = "CHECKING" | "SAVINGS" | "BUILDING_SAVINGS" | "INVESTMENT";

export interface Account {
  id: string;
  household_id: string;
  name: string;
  account_type: AccountType;
  balance: number;
  currency: string;
  target_amount?: number | null;
  maturity_date?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountCreate {
  name: string;
  account_type: AccountType;
  balance?: number;
  currency?: string;
  target_amount?: number | null;
  maturity_date?: string | null;
  is_active?: boolean;
}

export interface AccountUpdate {
  name?: string;
  account_type?: AccountType;
  balance?: number;
  currency?: string;
  target_amount?: number | null;
  maturity_date?: string | null;
  is_active?: boolean;
}

export interface BalanceSummaryResponse {
  total_balance: number;
  by_type: Record<AccountType, number>;
}

export interface NetWorthResponse {
  liquid_assets: number;
  investments: number;
  total_net_worth: number;
  accounts_count: number;
}
