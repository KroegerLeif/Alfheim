"use client";

import React from "react";
import { ShoppingCart, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface CartItemRowProps {
  name: string;
  onRemove: (name: string) => void;
}

/** One part in the cart. Long part names wrap instead of pushing the remove button out of the card. */
export function CartItemRow({ name, onRemove }: CartItemRowProps) {
  const t = useTranslations("maintenance");

  return (
    <li className="bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-xl p-4 border hover:border-[var(--border-accent)] transition-colors flex items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-[var(--primary-main)]/10 border border-[var(--primary-main)]/20 flex items-center justify-center text-[var(--primary-main)] shrink-0">
          <ShoppingCart className="h-4 w-4" />
        </div>
        <span className="min-w-0 break-words text-xs font-bold uppercase tracking-wide text-[var(--text-main)]">
          {name}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onRemove(name)}
        className="p-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:bg-red-500/10 hover:border-red-500/20 text-[var(--text-muted)] hover:text-red-500 transition-all cursor-pointer shrink-0"
        title={t("shopping.removeFromCart")}
        aria-label={`${t("shopping.removeFromCart")}: ${name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
