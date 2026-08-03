"use client";

import React, { useState } from "react";
import {
  BackToDashboard,
  LanguageSwitcher,
  ThemeToggle,
  AuthControls,
  HouseholdSwitcher,
} from "@loeger-os/shared";
import { useTranslations } from "next-intl";
import { useLayout, NavOption } from "./LayoutContext";
import { useAuth } from "../auth/AuthContext";
import { Bell, AlertTriangle, Clock, Calendar } from "lucide-react";
import { cn } from "../utils";

interface NotificationItem {
  id: string;
  type: "overdue" | "due_soon" | "info";
  message: string;
  time: string;
}

export function Header() {
  const t = useTranslations("maintenance");
  const { activeNav } = useLayout();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const authUser = user ? {
    name: user.name,
    preferred_username: user.username,
    email: user.email,
  } : null;

  const titleMap: Record<NavOption, string> = {
    devices: t("nav.deviceInventory"),
    maintenance: t("nav.maintenanceWork"),
    scheduled: t("nav.scheduledTasks"),
    history: t("nav.serviceHistory"),
    shopping: t("nav.maintenanceShopping"),
  };

  const notifications: NotificationItem[] = [];
  const alertCount = notifications.filter(n => n.type === "overdue" || n.type === "due_soon").length;

  return (
    <header className="h-16 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 flex items-center justify-between select-none relative shrink-0 transition-colors duration-200">
      {/* Back to Portal Link & Dynamic Title */}
      <div className="flex items-center gap-4">
        <BackToDashboard href="http://loeger-os/" />
        <h1 className="text-lg font-black text-[var(--text-main)] tracking-wide uppercase">
          {titleMap[activeNav]}
        </h1>
      </div>

      {/* Action Panel */}
      <div className="flex items-center gap-3">
        <HouseholdSwitcher />
        <LanguageSwitcher variant="dropdown" />
        <ThemeToggle showVariantToggle={true} />

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 transition-all text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer relative"
            aria-label={t("header.systemAlerts")}
          >
            <Bell className="h-4 w-4" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] font-black text-white flex items-center justify-center border border-[var(--surface-card)] shadow-md">
                {alertCount}
              </span>
            )}
          </button>

          {isOpen && (
            <>
              {/* Overlay background to capture clicks outside the dropdown */}
              <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
              
              <div className="absolute right-0 mt-2 w-80 z-20 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-3 shadow-2xl space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--text-main)]">
                    {t("header.systemAlerts")}
                  </span>
                  {alertCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                      {t("header.urgentBadge", { count: alertCount })}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] text-center py-4">
                      {t("header.noAlerts")}
                    </p>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={cn(
                          "p-2.5 rounded-xl border flex items-start gap-3 transition-colors",
                          notif.type === "overdue"
                            ? "bg-red-500/5 border-red-500/10 hover:bg-red-500/10"
                            : notif.type === "due_soon"
                            ? "bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10"
                            : "bg-[var(--surface-elevated)] border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)]/80"
                        )}
                      >
                        {notif.type === "overdue" ? (
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        ) : notif.type === "due_soon" ? (
                          <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <Calendar className="h-4 w-4 text-[var(--primary-main)] shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-main)] leading-tight">
                            {notif.message}
                          </p>
                          <span className="text-[10px] font-medium text-[var(--text-muted)] font-mono">
                            {notif.time}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <AuthControls user={authUser} onLogout={logout} />
      </div>
    </header>
  );
}
