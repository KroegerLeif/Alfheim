"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useTranslation } from "@alfheim/shared";
import { useTranslations } from "next-intl";
import { useDueAlerts } from "@/features/maintenance";
import { cn } from "@/core/utils";
import { useLayout } from "./LayoutContext";

/** Bell button with a dropdown of overdue and due-soon maintenance steps. */
export function NotificationMenu() {
  const t = useTranslations("maintenance");
  const { t: tShared } = useTranslation();
  const { setActiveNav } = useLayout();
  const alerts = useDueAlerts();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openScheduledTasks = () => {
    setActiveNav("scheduled");
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative cursor-pointer border border-[var(--border-subtle)]",
          isOpen ? "bg-[var(--primary-main)] text-black" : "bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
        )}
        aria-label={tShared("common.notifications")}
      >
        <Bell className="w-4 h-4" />
        {alerts.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse ring-2 ring-[var(--surface-card)]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-main)]">
              {t("header.notifications")}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {alerts.length > 0 ? t("header.urgentBadge", { count: alerts.length }) : t("header.allCaughtUp")}
            </span>
          </div>

          {alerts.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)] italic">
              {t("header.noNotifications")}
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={openScheduledTasks}
                    className="w-full text-left py-2.5 text-xs leading-snug break-words cursor-pointer hover:text-[var(--primary-main)] transition-colors"
                  >
                    <span className={cn("font-bold", alert.state === "overdue" ? "text-red-500" : "text-amber-500")}>
                      {alert.state === "overdue"
                        ? t("header.overdueItem", { step: alert.stepTitle, device: alert.deviceName, days: alert.days })
                        : t("header.dueSoonItem", { step: alert.stepTitle, device: alert.deviceName, days: alert.days })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
