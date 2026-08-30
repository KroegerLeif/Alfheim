import { budgetClient } from "@/core/api";
import {
  QuickAddTransactionCreate,
  Transaction,
  TransactionCreate,
  TransactionUpdate,
} from "@/features/budget/types";

export interface TransactionFilterOptions {
  accountId?: string;
  potId?: string;
  planId?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export const transactionsApi = {
  async listTransactions(filters?: TransactionFilterOptions): Promise<Transaction[]> {
    const searchParams = new URLSearchParams();
    if (filters?.accountId) searchParams.append("account_id", filters.accountId);
    if (filters?.potId) searchParams.append("pot_id", filters.potId);
    if (filters?.planId) searchParams.append("plan_id", filters.planId);
    if (filters?.categoryId) searchParams.append("category_id", filters.categoryId);
    if (filters?.limit) searchParams.append("limit", filters.limit.toString());
    if (filters?.offset) searchParams.append("offset", filters.offset.toString());

    const query = searchParams.toString();
    const endpoint = query ? `transactions?${query}` : "transactions";
    return budgetClient.get(endpoint).json<Transaction[]>();
  },

  async getTransaction(id: string): Promise<Transaction> {
    return budgetClient.get(`transactions/${id}`).json<Transaction>();
  },

  async createTransaction(data: TransactionCreate): Promise<Transaction> {
    return budgetClient.post("transactions", { json: data }).json<Transaction>();
  },

  async quickAddTransaction(data: QuickAddTransactionCreate): Promise<Transaction> {
    return budgetClient.post("transactions/quick-add", { json: data }).json<Transaction>();
  },

  async updateTransaction(id: string, data: TransactionUpdate): Promise<Transaction> {
    return budgetClient.patch(`transactions/${id}`, { json: data }).json<Transaction>();
  },

  async deleteTransaction(id: string): Promise<void> {
    await budgetClient.delete(`transactions/${id}`);
  },
};
