"use client";

import React, { useState, useRef, useEffect } from "react";
import { AppHeader } from "@alfheim/shared";
import { useTranslations } from "next-intl";
import { useLayout, NavOption } from "./LayoutContext";
import { useAuth } from "@/core/auth/AuthContext";
import { Bell } from "lucide-react";
import { cn } from "@/core/utils";

interface NotificationItem {
  id: string;
  type: "overdue" | "due_soon" | "info";
  message: string;
  time: string;
}

/**
 * Maintenance Header utilizing the canonical @alfheim/shared AppHeader layout.
 */
export function Header() {
  const t = useTranslations("maintenance");
  const { activeNav } = useLayout();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notifications: NotificationItem[] = [];
  const alertCount = notifications.filter(n => n.type === "overdue" || n.type === "due_soon").length;

  return (
    <AppHeader
      appName="maintenance"
      brandTitle="ALFHEIM // MAINTENANCE"
      brandSubtitle={titleMap[activeNav] || "Device & Service Registry"}
      showBackToDashboard={true}
      backToDashboardHref={process.env.NEXT_PUBLIC_FRONTEND_URL || "http://alfheim.loegien.localhost"}
      user={authUser}
      onLogout={logout}
      notificationSlot={
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative cursor-pointer border border-[var(--border-subtle)]",
              isOpen ? "bg-[var(--primary-main)] text-black" : "bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            )}
            aria-label="Maintenance Notifications"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse ring-2 ring-[var(--surface-card)]" />
            )}
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-main)]">
                  {t("header.notifications")}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  {t("header.allCaughtUp")}
                </span>
              </div>
              <div className="py-6 text-center text-xs text-[var(--text-muted)] italic">
                {t("header.noNotifications")}
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
