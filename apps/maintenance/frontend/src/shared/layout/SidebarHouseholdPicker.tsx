"use client";

import React, { useState } from "react";
import { useLayout } from "./LayoutContext";
import { useHouseholds } from "@/features/devices";
import { ChevronDown, Home, Check } from "lucide-react";
import { cn } from "@/core/utils";
import { useTranslations } from "next-intl";

export function SidebarHouseholdPicker() {
  const t = useTranslations("maintenance");
  const { householdId, setHouseholdId, isSidebarCollapsed } = useLayout();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch households using FDD hook
  const { data: households = [] } = useHouseholds();

  React.useEffect(() => {
    const list = households ?? [];
    if (householdId === undefined && list.length > 0) {
      setHouseholdId(list[0].id);
    }
  }, [householdId, households, setHouseholdId]);

  const list = households ?? [];
  const selectedHousehold = list.find((h) => h.id.toString() === householdId?.toString());
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
                    (householdId === null || householdId === undefined)
                      ? "bg-[var(--primary-main)]/10 text-[var(--primary-main)] font-bold"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
                  )}
                >
                  <span>{allHouseholdsLabel}</span>
                  {(householdId === null || householdId === undefined) && <Check className="h-3.5 w-3.5" />}
                </button>
                {list.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setHouseholdId(h.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer",
                      (householdId?.toString() === h.id.toString())
                        ? "bg-[var(--primary-main)]/10 text-[var(--primary-main)] font-bold"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
                    )}
                  >
                    <span className="truncate">{h.name}</span>
                    {(householdId?.toString() === h.id.toString()) && <Check className="h-3.5 w-3.5" />}
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
