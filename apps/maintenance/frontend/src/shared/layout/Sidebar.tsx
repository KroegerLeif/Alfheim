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
  ChevronRight,
  Sun,
  Moon
} from "lucide-react";
import { cn } from "../utils";
import { useTheme } from "next-themes";
import { useAuth } from "../auth/AuthContext";

export function Sidebar() {
  const { activeNav, setActiveNav, isSidebarCollapsed, setIsSidebarCollapsed } = useLayout();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { id: "devices" as NavOption, label: "Device Inventory", icon: Laptop },
    { id: "maintenance" as NavOption, label: "Maintenance Work", icon: Wrench },
    { id: "scheduled" as NavOption, label: "Scheduled Tasks", icon: CalendarClock },
    { id: "history" as NavOption, label: "Service History", icon: History },
    { id: "shopping" as NavOption, label: "Maintenance Shopping", icon: ShoppingCart },
  ];

  const activeTheme = resolvedTheme || theme;
  const isDark = activeTheme === "dark";

  return (
    <aside
      className={cn(
        "h-screen select-none bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex flex-col transition-all duration-300 ease-in-out shrink-0 relative",
        isSidebarCollapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand Header */}
      <div className={cn("p-5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between", isSidebarCollapsed && "justify-center")}>
        {!isSidebarCollapsed && (
          <div className="flex flex-col gap-1">
            <span className="font-heading text-2xl font-black uppercase tracking-wide leading-none text-slate-900 dark:text-white">
              LOEGER // OS
            </span>
            <span className="text-[9px] text-cyan-600 dark:text-cyan-400 font-semibold uppercase tracking-widest leading-none">
              Maintenance v1.0
            </span>
          </div>
        )}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={cn(
            "p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer",
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
                  ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30 dark:border-cyan-500/25 font-bold"
                  : "bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
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
      <div className="p-4 border-t border-slate-200 dark:border-white/5 space-y-3">
        {/* Dynamic Keycloak User Profile Card */}
        {user ? (
          <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5", isSidebarCollapsed && "justify-center p-0 bg-transparent dark:bg-transparent border-0")}>
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-black text-sm shrink-0">
              {user.initials}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold uppercase tracking-wider truncate">
                  {user.role}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className={cn("flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5", isSidebarCollapsed && "justify-center p-0 bg-transparent dark:bg-transparent border-0")}>
            <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs shrink-0">
              --
            </div>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">
                  Authenticated User
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                  Maintenance User
                </span>
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle Button */}
        {mounted && (
          <div className={cn("flex items-center justify-between pt-1", isSidebarCollapsed && "justify-center")}>
            {!isSidebarCollapsed && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                Theme Toggle
              </span>
            )}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              aria-label="Toggle visual theme"
            >
              {isDark ? (
                <Sun className="h-4.5 w-4.5 text-amber-500 dark:text-amber-400 transition-transform duration-500 hover:rotate-45" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400 transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
