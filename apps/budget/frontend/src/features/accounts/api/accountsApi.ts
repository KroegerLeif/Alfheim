import { budgetClient } from "@/core/api";
import {
  Account,
  AccountCreate,
  AccountUpdate,
  BalanceSummaryResponse,
  NetWorthResponse,
} from "@/features/budget/types";

export const accountsApi = {
  async listAccounts(includeInactive = false): Promise<Account[]> {
    return budgetClient.get(`accounts?include_inactive=${includeInactive}`).json<Account[]>();
  },

  async getNetWorth(): Promise<NetWorthResponse> {
    return budgetClient.get("accounts/net-worth").json<NetWorthResponse>();
  },

  async getBalanceSummary(): Promise<BalanceSummaryResponse> {
    return budgetClient.get("accounts/summary").json<BalanceSummaryResponse>();
  },

  async createAccount(data: AccountCreate): Promise<Account> {
    return budgetClient.post("accounts", { json: data }).json<Account>();
  },

  async updateAccount(id: string, data: AccountUpdate): Promise<Account> {
    return budgetClient.patch(`accounts/${id}`, { json: data }).json<Account>();
  },

  async deleteAccount(id: string): Promise<void> {
    await budgetClient.delete(`accounts/${id}`);
  },
};
