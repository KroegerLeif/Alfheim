"use client";

import React, { useState, useEffect } from "react";
import { 
  ShoppingCart, 
  Download, 
  Send, 
  Trash2, 
  CheckCircle2 
} from "lucide-react";
import { cn } from "@/core/utils";
import { useTranslations } from "next-intl";

export function ShoppingView() {
  const t = useTranslations("maintenance");
  const [cart, setCart] = useState<string[]>([]);
  const [isSent, setIsSent] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cart_maintenance-frontend");
      if (stored) {
        try {
          setCart(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const updateCart = (newCart: string[]) => {
    setCart(newCart);
    if (typeof window !== "undefined") {
      localStorage.setItem("cart_maintenance-frontend", JSON.stringify(newCart));
    }
  };

  const handleRemove = (itemName: string) => {
    updateCart(cart.filter((item) => item !== itemName));
  };

  const handleClear = () => {
    updateCart([]);
  };

  const handleExport = () => {
    const cartList = cart ?? [];
    if (cartList.length === 0) return;
    const headers = ["Part Name", "Status"];
    const rows = cartList.map((item) => [item, "Required"]);
    const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "loeger-os-shopping.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendToShoppingApp = () => {
    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      handleClear();
    }, 2000);
  };

  const cartList = cart ?? [];

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

        {cartList.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] hover:bg-red-500/10 hover:border-red-500/20 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-red-500 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("shopping.clear")}
            </button>
            <button
              onClick={handleExport}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {t("shopping.csvExport")}
            </button>
          </div>
        )}
      </div>

      {/* Main Cart Layout */}
      {cartList.length === 0 ? (
        <div className="bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-2xl border p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <ShoppingCart className="h-10 w-10 text-[var(--primary-main)] mx-auto" />
          <h3 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-wide">
            {t("shopping.cartEmpty")}
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            {t("shopping.cartEmptyDesc")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cart Items List */}
          <div className="space-y-3">
            {cartList.map((item) => (
              <div
                key={item}
                className="bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-xl p-4 border hover:border-[var(--border-accent)] transition-colors flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[var(--primary-main)]/10 border border-[var(--primary-main)]/20 flex items-center justify-center text-[var(--primary-main)]">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide text-[var(--text-main)]">
                    {item}
                  </span>
                </div>

                <button
                  onClick={() => handleRemove(item)}
                  className="p-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:bg-red-500/10 hover:border-red-500/20 text-[var(--text-muted)] hover:text-red-500 transition-all cursor-pointer"
                  title={t("shopping.removeFromCart")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Call-to-Action Block */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex justify-end">
            <button
              onClick={handleSendToShoppingApp}
              disabled={isSent}
              className={cn(
                "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg",
                isSent
                  ? "bg-emerald-500 text-black shadow-emerald-500/10"
                  : "bg-[var(--primary-main)] hover:opacity-90 text-black hover:scale-[1.02] shadow-[var(--primary-main)]/10"
              )}
            >
              {isSent ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t("shopping.sentToShoppingApp")}
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

    </div>
  );
}
