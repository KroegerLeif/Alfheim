"use client";

import React from "react";
import { MoneyDisplay } from "@alfheim/shared";
import { Account } from "@/features/budget/types";
import { CreditCard, Landmark, LineChart, Building, Plus, Trash2, Edit2 } from "lucide-react";

export interface AccountListProps {
  accounts: Account[];
  loading?: boolean;
  onAddAccount: () => void;
  onEditAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
}

const getAccountIcon = (type: string) => {
  switch (type) {
    case "CHECKING":
      return <CreditCard className="w-5 h-5 text-blue-500" />;
    case "SAVINGS":
      return <Landmark className="w-5 h-5 text-emerald-500" />;
    case "INVESTMENT":
      return <LineChart className="w-5 h-5 text-purple-500" />;
    case "BUILDING_SAVINGS":
      return <Building className="w-5 h-5 text-amber-500" />;
    default:
      return <CreditCard className="w-5 h-5 text-gray-500" />;
  }
};

export function AccountList({
  accounts,
  loading,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
}: AccountListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--surface-card)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-main)]">Accounts</h3>
        <button
          type="button"
          onClick={onAddAccount}
          className="px-3 py-1.5 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium flex items-center gap-1.5 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          <span>New Account</span>
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm">
          No accounts registered yet. Click &quot;New Account&quot; to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between shadow-xs hover:border-[var(--primary-main)]/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[var(--surface-canvas)]">
                  {getAccountIcon(acc.account_type)}
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-[var(--text-main)]">{acc.name}</h4>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                    {acc.account_type.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <MoneyDisplay amount={acc.balance} currency={acc.currency} size="md" className="font-bold" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEditAccount(acc)}
                    aria-label={`Edit ${acc.name}`}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-canvas)] hover:text-[var(--text-main)]"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteAccount(acc.id)}
                    aria-label={`Delete ${acc.name}`}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
