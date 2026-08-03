"use client";

import React, { useEffect, useState } from "react";
import { useLayout, NavOption } from "./LayoutContext";
import { SidebarHouseholdPicker } from "./SidebarHouseholdPicker";
import { 
  Laptop, 
  Wrench, 
  CalendarClock, 
  History, 
  ShoppingCart, 
  ChevronLeft, 
  ChevronRight
} from "lucide-react";
import { cn } from "../utils";
import { useAuth } from "../auth/AuthContext";
import { useTranslations } from "next-intl";

export function Sidebar() {
  const t = useTranslations("maintenance");
  const { activeNav, setActiveNav, isSidebarCollapsed, setIsSidebarCollapsed } = useLayout();
  const { user } = useAuth();
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
        "h-screen select-none bg-[var(--surface-card)] border-r border-[var(--border-subtle)] text-[var(--text-main)] flex flex-col transition-all duration-300 ease-in-out shrink-0 relative",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand Header */}
      <div className={cn("p-5 border-b border-[var(--border-subtle)] flex items-center justify-between", isSidebarCollapsed && "justify-center")}>
        {!isSidebarCollapsed && (
          <div className="flex flex-col gap-1">
            <span className="font-heading text-2xl font-black uppercase tracking-wide leading-none text-[var(--text-main)]">
              LOEGER // OS
            </span>
            <span className="text-[9px] text-[var(--primary-main)] font-semibold uppercase tracking-widest leading-none">
              Maintenance v1.0
            </span>
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

      {/* Household Selector */}
      <SidebarHouseholdPicker />

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5">
        {navItems.map((item) => {
          const isActive = activeNav === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={cn(
                "w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-semibold uppercase tracking-wide border transition-all cursor-pointer",
                isActive
                  ? "bg-[var(--primary-main)]/10 text-[var(--primary-main)] border-[var(--primary-main)]/30 font-bold"
                  : "bg-transparent border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
              )}
              title={item.label}
            >
              <Icon className={cn("h-4.5 w-4.5 shrink-0 transition-transform duration-300", isActive && "scale-110")} />
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer Area */}
      <div className="p-4 border-t border-[var(--border-subtle)] space-y-3">
        {/* Dynamic Keycloak User Profile Card */}
        {user ? (
          <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)]", isSidebarCollapsed && "justify-center p-0 bg-transparent border-0")}>
            <div className="h-10 w-10 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--primary-main)]/20 flex items-center justify-center text-[var(--primary-main)] font-black text-sm shrink-0">
              {user.initials}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-[var(--text-main)] truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-[var(--primary-main)] font-semibold uppercase tracking-wider truncate">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)]", isSidebarCollapsed && "justify-center p-0 bg-transparent border-0")}>
            <div className="h-10 w-10 rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center text-[var(--text-muted)] font-bold text-xs shrink-0">
              --
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[var(--text-main)] truncate">
                  User Session
                </span>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider truncate">
                  Maintenance
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
