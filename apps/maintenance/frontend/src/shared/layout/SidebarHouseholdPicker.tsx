"use client";

import React, { useState } from "react";
import { useLayout } from "./LayoutContext";
import { useQuery } from "@tanstack/react-query";
import { getHouseholds } from "../api";
import { ChevronDown, Home, Check } from "lucide-react";
import { cn } from "../utils";
import { useTranslations } from "next-intl";

export function SidebarHouseholdPicker() {
  const t = useTranslations("maintenance");
  const { householdId, setHouseholdId, isSidebarCollapsed } = useLayout();
  const [isOpen, setIsOpen] = useState(false);

  const { data: households = [] } = useQuery({
    queryKey: ["households"],
    queryFn: getHouseholds,
  });

  React.useEffect(() => {
    if (householdId === null && households.length > 0) {
      setHouseholdId(households[0].id);
    }
  }, [householdId, households, setHouseholdId]);

  const selectedHousehold = households.find((h) => h.id === householdId);
  const allHouseholdsLabel = t("deviceInventory.otherLocations");

  return (
    <div className="relative w-full px-4 py-2 border-b border-[var(--border-subtle)]">
      {isSidebarCollapsed ? (
        <div className="flex justify-center py-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] text-[var(--primary-main)] border border-[var(--border-subtle)] transition-all cursor-pointer"
            title={t("wizard.household")}
          >
            <Home className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-sm font-semibold transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-[var(--text-main)]">
              <Home className="h-4 w-4 text-[var(--primary-main)]" />
              <span className="truncate">
                {selectedHousehold ? selectedHousehold.name : allHouseholdsLabel}
              </span>
            </div>
            <ChevronDown className={cn("h-4 w-4 text-[var(--text-muted)] transition-transform duration-200", isOpen && "rotate-180")} />
          </button>

          {isOpen && (
            <>
              {/* Backdrop element to close the dropdown when clicking outside */}
              <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
              
              <div className="absolute left-4 right-4 mt-1.5 z-20 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-1.5 shadow-2xl space-y-0.5">
                <button
                  onClick={() => {
                    setHouseholdId(null);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer",
                    householdId === null
                      ? "bg-[var(--primary-main)]/10 text-[var(--primary-main)] font-bold"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
                  )}
                >
                  <span>{allHouseholdsLabel}</span>
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
                        ? "bg-[var(--primary-main)]/10 text-[var(--primary-main)] font-bold"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
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
