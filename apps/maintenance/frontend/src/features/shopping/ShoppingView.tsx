"use client";

import React, { useState, useEffect } from "react";
import { 
  ShoppingCart, 
  Download, 
  Send, 
  Trash2, 
  CheckCircle2 
} from "lucide-react";
import { cn } from "@/shared/utils";

export function ShoppingView() {
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
    if (cart.length === 0) return;
    const headers = ["Part Name", "Status"];
    const rows = cart.map((item) => [item, "Required"]);
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

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans text-slate-900 dark:text-white">
      
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
            Shopping Cart //
          </span>
        </div>

        {cart.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 hover:bg-red-500/10 hover:border-red-500/20 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
            <button
              onClick={handleExport}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              CSV Export
            </button>
          </div>
        )}
      </div>

      {/* Main Cart Layout */}
      {cart.length === 0 ? (
        <div className="bg-white border-slate-200 text-slate-900 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-100 rounded-2xl border p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <ShoppingCart className="h-10 w-10 text-cyan-600 dark:text-cyan-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Your Cart is Empty</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            To add parts to your shopping list, start a maintenance wizard and select associated parts on the supplies panel.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cart Items List */}
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item}
                className="bg-white border-slate-200 text-slate-900 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-100 rounded-xl p-4 border hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-center justify-between gap-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">
                    {item}
                  </span>
                </div>

                <button
                  onClick={() => handleRemove(item)}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 hover:bg-red-500/10 hover:border-red-500/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer"
                  title="Remove from cart"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Call-to-Action Block */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={handleSendToShoppingApp}
              disabled={isSent}
              className={cn(
                "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg",
                isSent
                  ? "bg-emerald-500 text-black shadow-emerald-500/10"
                  : "bg-cyan-500 hover:bg-cyan-400 text-black hover:scale-[1.02] shadow-cyan-500/10"
              )}
            >
              {isSent ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Sent to Shopping App!
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send to Shopping App
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
