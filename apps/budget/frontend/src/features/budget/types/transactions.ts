export type TransactionType = "EXPENSE" | "INCOME" | "TRANSFER";

export interface Transaction {
  id: string;
  household_id: string;
  description: string;
  amount: number;
  currency: string;
  transaction_type: TransactionType;
  transaction_date: string;
  account_id?: string | null;
  pot_id?: string | null;
  plan_id?: string | null;
  category_id?: string | null;
  receipt_url?: string | null;
  is_quick_add: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransactionCreate {
  description: string;
  amount: number;
  currency?: string;
  transaction_type?: TransactionType;
  transaction_date?: string;
  account_id?: string | null;
  pot_id?: string | null;
  plan_id?: string | null;
  category_id?: string | null;
  receipt_url?: string | null;
  is_quick_add?: boolean;
}

export interface TransactionUpdate {
  description?: string;
  amount?: number;
  currency?: string;
  transaction_type?: TransactionType;
  transaction_date?: string;
  account_id?: string | null;
  pot_id?: string | null;
  plan_id?: string | null;
  category_id?: string | null;
  receipt_url?: string | null;
  is_quick_add?: boolean;
}

export interface QuickAddTransactionCreate {
  description: string;
  amount: number;
  transaction_type?: TransactionType;
  currency?: string;
  transaction_date?: string;
  account_id?: string | null;
  pot_id?: string | null;
  plan_id?: string | null;
  category_id?: string | null;
  receipt_url?: string | null;
}
