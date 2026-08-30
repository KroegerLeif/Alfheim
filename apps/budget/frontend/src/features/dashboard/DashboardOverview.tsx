"use client";

import React from "react";
import { NetWorthCard, AccountList } from "@/features/accounts";
import { PotCard } from "@/features/pots";
import { TransactionLedger } from "@/features/transactions";
import { NetWorthResponse, Account, Pot, Transaction } from "@/features/budget/types";
import { GitMerge } from "lucide-react";

export interface DashboardOverviewProps {
  netWorth: NetWorthResponse | null;
  accounts: Account[];
  pots: Pot[];
  transactions: Transaction[];
  loading: boolean;
  onAddAccount: () => void;
  onEditAccount: (acc: Account) => void;
  onDeleteAccount: (id: string) => void;
  onEditPot: (pot: Pot) => void;
  onDeletePot: (id: string) => void;
  onOpenCascadeModal: () => void;
  onQuickAdd: () => void;
  onDeleteTransaction: (id: string) => void;
}

export function DashboardOverview({
  netWorth,
  accounts,
  pots,
  transactions,
  loading,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onEditPot,
  onDeletePot,
  onOpenCascadeModal,
  onQuickAdd,
  onDeleteTransaction,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <NetWorthCard summary={netWorth} loading={loading} />
        </div>
        <div className="lg:col-span-2">
          <AccountList
            accounts={accounts}
            loading={loading}
            onAddAccount={onAddAccount}
            onEditAccount={onEditAccount}
            onDeleteAccount={onDeleteAccount}
          />
        </div>
      </div>

      {/* Virtual Pots Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--text-main)]">Virtual Pots</h3>
          <button
            type="button"
            onClick={onOpenCascadeModal}
            className="px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--primary-main)] flex items-center gap-1.5 hover:bg-[var(--surface-canvas)]"
          >
            <GitMerge className="w-4 h-4 text-[var(--primary-main)]" />
            <span>Cascade Surplus</span>
          </button>
        </div>
        {pots.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
            No virtual pots configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pots.map((pot) => (
              <PotCard key={pot.id} pot={pot} onEdit={onEditPot} onDelete={onDeletePot} />
            ))}
          </div>
        )}
      </div>

      {/* Transaction Ledger */}
      <TransactionLedger
        transactions={transactions.slice(0, 5)}
        loading={loading}
        onNewTransaction={onQuickAdd}
        onDeleteTransaction={onDeleteTransaction}
      />
    </div>
  );
}
