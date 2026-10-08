"use client";

import React, { useEffect, useState } from "react";
import { ShoppingCart, Download, Send, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/core/utils";
import { useTranslations } from "next-intl";
import { useCart } from "../hooks/useCart";
import { useSendToShopping } from "../hooks/useSendToShopping";
import { buildCartCsv } from "../utils/csv";
import { CartItemRow } from "./CartItemRow";

/** How long the "sent" confirmation stays on the button. */
const SENT_FLASH_MS = 2000;

export function ShoppingView() {
  const t = useTranslations("maintenance");
  const { cart, replace, remove, clear } = useCart();
  const sendMutation = useSendToShopping();
  const [showSent, setShowSent] = useState(false);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!showSent) return;
    const timer = setTimeout(() => setShowSent(false), SENT_FLASH_MS);
    return () => clearTimeout(timer);
  }, [showSent]);

  const handleExport = () => {
    if (cart.length === 0) return;
    const csvContent = buildCartCsv(cart, {
      partName: t("shopping.csvPartName"),
      status: t("shopping.csvStatus"),
      required: t("shopping.csvRequired"),
    });
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "alfheim-shopping.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendToShoppingApp = () => {
    const total = cart.length;
    if (total === 0 || sendMutation.isPending) return;
    setFailedCount(0);
    sendMutation.mutate(cart, {
      onSuccess: ({ failed }) => {
        // Only parts the shopping app accepted leave the cart.
        replace(failed);
        setFailedCount(failed.length);
        setShowSent(failed.length === 0);
      },
    });
  };

  const isSending = sendMutation.isPending;
  const sentCount = sendMutation.data?.sent.length ?? 0;
  const failedMessage =
    failedCount === 0
      ? null
      : sentCount === 0
        ? t("shopping.sendFailed")
        : t("shopping.partialSendFailed", { failed: failedCount, total: failedCount + sentCount });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans text-[var(--text-main)]">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-[var(--primary-main)]" />
          <span className="text-xs font-black uppercase tracking-widest text-[var(--primary-main)]">
            {t("shopping.tagline")}
          </span>
        </div>

        {cart.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clear}
              disabled={isSending}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] hover:bg-red-500/10 hover:border-red-500/20 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-red-500 transition-all cursor-pointer flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("shopping.clear")}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {t("shopping.csvExport")}
            </button>
          </div>
        )}
      </div>

      {failedMessage && (
        <p role="alert" className="border border-rose-800/40 bg-rose-950/20 text-rose-400 p-3 text-xs font-semibold rounded-lg break-words">
          {failedMessage}
        </p>
      )}

      {cart.length === 0 ? (
        <div className="bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-2xl border p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <ShoppingCart className="h-10 w-10 text-[var(--primary-main)] mx-auto" />
          <h3 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-wide">
            {t("shopping.cartEmpty")}
          </h3>
          <p className="text-sm text-[var(--text-muted)]">{t("shopping.cartEmptyDesc")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ul className="space-y-3">
            {cart.map((item) => (
              <CartItemRow key={item} name={item} onRemove={remove} />
            ))}
          </ul>

          <div className="pt-4 border-t border-[var(--border-subtle)] flex justify-end">
            <button
              type="button"
              onClick={handleSendToShoppingApp}
              disabled={isSending || showSent}
              className={cn(
                "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg disabled:cursor-not-allowed",
                showSent
                  ? "bg-emerald-500 text-black shadow-emerald-500/10"
                  : "bg-[var(--primary-main)] hover:opacity-90 text-black shadow-[var(--primary-main)]/10"
              )}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("shopping.sending")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t("shopping.sendToShoppingApp")}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* The cart is empty again once everything was sent, so the confirmation lives outside the cart branch. */}
      {showSent && (
        <p role="status" className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-500">
          <CheckCircle2 className="h-4 w-4" />
          {t("shopping.sentToShoppingApp")}
        </p>
      )}
    </div>
  );
}
