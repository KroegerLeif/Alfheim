"use client";

import React, { useState } from "react";
import { useLayout } from "./LayoutContext";
import { useQuery } from "@tanstack/react-query";
import { getHouseholds } from "../api";
import { ChevronDown, Home, Check } from "lucide-react";
import { cn } from "../utils";

export function SidebarHouseholdPicker() {
  const { householdId, setHouseholdId, isSidebarCollapsed } = useLayout();
  const [isOpen, setIsOpen] = useState(false);

  const { data: households = [] } = useQuery({
    queryKey: ["households"],
    queryFn: getHouseholds,
  });

  const selectedHousehold = households.find((h) => h.id === householdId);

  return (
    <div className="relative w-full px-4 py-2 border-b border-slate-200 dark:border-slate-800">
      {isSidebarCollapsed ? (
        <div className="flex justify-center py-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
            title="Switch Household"
          >
            <Home className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-sm font-semibold transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-200">
              <Home className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span className="truncate">
                {selectedHousehold ? selectedHousehold.name : "All Households"}
              </span>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
          </button>

          {isOpen && (
            <>
              {/* Backdrop element to close the dropdown when clicking outside */}
              <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
              
              <div className="absolute left-4 right-4 mt-1.5 z-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 shadow-2xl space-y-0.5">
                <button
                  onClick={() => {
                    setHouseholdId(null);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer",
                    householdId === null
                      ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                  )}
                >
                  <span>All Households</span>
                  {householdId === null && <Check className="h-3.5 w-3.5" />}
                </button>
                {households.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setHouseholdId(h.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer",
                      householdId === h.id
                        ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                  >
                    <span className="truncate">{h.name}</span>
                    {householdId === h.id && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
