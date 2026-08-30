"use client";

import React from "react";
import { MoneyDisplay } from "@alfheim/shared";
import { Transaction } from "@/features/budget/types";
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Trash2, Calendar, Plus } from "lucide-react";

export interface TransactionLedgerProps {
  transactions: Transaction[];
  loading?: boolean;
  onNewTransaction: () => void;
  onDeleteTransaction: (id: string) => void;
}

const getTypeBadge = (type: string) => {
  switch (type) {
    case "INCOME":
      return (
        <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
          <ArrowDownLeft className="w-4 h-4" />
        </span>
      );
    case "EXPENSE":
      return (
        <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
          <ArrowUpRight className="w-4 h-4" />
        </span>
      );
    default:
      return (
        <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
          <ArrowLeftRight className="w-4 h-4" />
        </span>
      );
  }
};

export function TransactionLedger({
  transactions,
  loading,
  onNewTransaction,
  onDeleteTransaction,
}: TransactionLedgerProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-[var(--surface-card)] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-main)]">Transaction Ledger</h3>
        <button
          type="button"
          onClick={onNewTransaction}
          className="px-3 py-1.5 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium flex items-center gap-1.5 hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          <span>Quick-Add</span>
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-muted)]">
          No transactions recorded yet. Click &quot;Quick-Add&quot; to log your first transaction.
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const isExpense = tx.transaction_type === "EXPENSE";
            const isIncome = tx.transaction_type === "INCOME";
            const signAmount = isExpense ? -Math.abs(tx.amount) : Math.abs(tx.amount);

            return (
              <div
                key={tx.id}
                className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between shadow-xs hover:border-[var(--primary-main)]/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  {getTypeBadge(tx.transaction_type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-[var(--text-main)]">{tx.description}</h4>
                      {tx.is_quick_add && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/10 text-amber-500 uppercase">
                          Quick
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {tx.transaction_date}
                      </span>
                      <span className="uppercase font-mono text-[10px]">{tx.transaction_type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MoneyDisplay
                    amount={signAmount}
                    currency={tx.currency}
                    colored={true}
                    showSign={isIncome}
                    size="md"
                    className="font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteTransaction(tx.id)}
                    aria-label={`Delete transaction ${tx.description}`}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
