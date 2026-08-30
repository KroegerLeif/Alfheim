"use client";

import React, { useState, useEffect } from "react";
import { Account, AccountCreate, AccountType } from "@/features/budget/types";
import { X } from "lucide-react";

export interface AccountDialogProps {
  open: boolean;
  account?: Account | null;
  onClose: () => void;
  onSubmit: (data: AccountCreate) => Promise<void>;
}

export function AccountDialog({ open, account, onClose, onSubmit }: AccountDialogProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("CHECKING");
  const [balance, setBalance] = useState("0.00");
  const [currency, setCurrency] = useState("EUR");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setAccountType(account.account_type);
      setBalance(account.balance.toString());
      setCurrency(account.currency);
    } else {
      setName("");
      setAccountType("CHECKING");
      setBalance("0.00");
      setCurrency("EUR");
    }
  }, [account, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        account_type: accountType,
        balance: parseFloat(balance) || 0,
        currency,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
          <h3 className="text-lg font-bold text-[var(--text-main)]">
            {account ? "Edit Account" : "Create Account"}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--surface-canvas)]">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Account Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary Checking"
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as AccountType)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)]"
            >
              <option value="CHECKING">Checking Account</option>
              <option value="SAVINGS">Savings Account</option>
              <option value="BUILDING_SAVINGS">Building Savings</option>
              <option value="INVESTMENT">Investment Account</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Current Balance</label>
              <input
                type="number"
                step="0.01"
                required
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)] font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Currency</label>
              <input
                type="text"
                required
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--primary-main)] uppercase"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-canvas)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : account ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
