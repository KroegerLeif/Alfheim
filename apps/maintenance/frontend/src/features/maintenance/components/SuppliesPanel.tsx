"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, PackagePlus, PackageMinus } from "lucide-react";
import { cn } from "@/core/utils";

interface SuppliesPanelProps {
  currentSupplyItem: string | null;
  isPartInCart: boolean;
  toggleCartPart: () => void;
  isPending: boolean;
}

export function SuppliesPanel({
  currentSupplyItem,
  isPartInCart,
  toggleCartPart,
  isPending,
}: SuppliesPanelProps) {
  const t = useTranslations("maintenance");

  return (
    <div className="hidden lg:flex lg:col-span-3 border-l border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 flex-col space-y-4 overflow-y-auto">
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--border-subtle)] text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
        <ShoppingCart className="h-4 w-4 text-[var(--text-muted)]" />
        <span>{t("shopping.associatedSupplies")}</span>
      </div>

      {currentSupplyItem ? (
        <div className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--primary-main)] block">
              {t("shopping.requiredPart")}
            </span>
            <p className="text-xs font-bold text-[var(--text-main)] leading-tight">{currentSupplyItem}</p>
          </div>

          <button
            onClick={toggleCartPart}
            disabled={isPending}
            className={cn(
              "w-full py-2.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer",
              isPartInCart
                ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
                : "bg-[var(--primary-main)] hover:opacity-90 text-black border-transparent shadow-lg shadow-[var(--primary-main)]/5"
            )}
          >
            {isPartInCart ? (
              <>
                <PackageMinus className="h-4 w-4" />
                {t("shopping.removeFromList")}
              </>
            ) : (
              <>
                <PackagePlus className="h-4 w-4" />
                {t("shopping.selectForCart")}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-center">
          <p className="text-xs text-[var(--text-muted)]">
            {t("shopping.cartEmpty")}
          </p>
        </div>
      )}
    </div>
  );
}
