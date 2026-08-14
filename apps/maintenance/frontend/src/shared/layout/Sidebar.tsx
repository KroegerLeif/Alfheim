"use client";

import React, { useEffect, useState } from "react";
import { useLayout, NavOption } from "./LayoutContext";
import { AppLogo } from "@alfheim/shared";
import { 
  Laptop, 
  Wrench, 
  CalendarClock, 
  History, 
  ShoppingCart, 
  ChevronLeft, 
  ChevronRight
} from "lucide-react";
import { cn } from "@/core/utils";
import { useTranslations } from "next-intl";

export function Sidebar() {
  const t = useTranslations("maintenance");
  const { activeNav, setActiveNav, isSidebarCollapsed, setIsSidebarCollapsed } = useLayout();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { id: "devices" as NavOption, label: t("nav.deviceInventory"), icon: Laptop },
    { id: "maintenance" as NavOption, label: t("nav.maintenanceWork"), icon: Wrench },
    { id: "scheduled" as NavOption, label: t("nav.scheduledTasks"), icon: CalendarClock },
    { id: "history" as NavOption, label: t("nav.serviceHistory"), icon: History },
    { id: "shopping" as NavOption, label: t("nav.maintenanceShopping"), icon: ShoppingCart },
  ];

  return (
    <aside
      className={cn(
        "h-screen select-none bg-[var(--surface-card)] border-r border-[var(--border-subtle)] text-[var(--text-main)] flex flex-col font-sans transition-all duration-300 ease-in-out shrink-0 relative",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand Header */}
      <div className={cn("p-5 border-b border-[var(--border-subtle)] flex items-center justify-between", isSidebarCollapsed && "justify-center")}>
        {!isSidebarCollapsed && (
          <div className="flex items-center gap-3">
            <AppLogo appName="maintenance" size={32} />
            <div className="flex flex-col">
              <span className="font-heading text-sm font-bold uppercase tracking-wider text-[var(--text-main)] leading-tight">
                ALFHEIM // MAINTENANCE
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest leading-none">
                Device & Service Registry
              </span>
            </div>
          </div>
        )}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={cn(
            "p-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer",
            isSidebarCollapsed && "mx-auto"
          )}
          aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={cn(
                "w-full flex items-center gap-3 text-xs uppercase font-semibold transition-all border border-transparent cursor-pointer rounded-lg",
                isSidebarCollapsed ? "justify-center p-3" : "px-3.5 py-2.5",
                isActive
                  ? "bg-[var(--primary-main)] text-black font-bold border-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]"
                  : "hover:bg-[var(--surface-elevated)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
