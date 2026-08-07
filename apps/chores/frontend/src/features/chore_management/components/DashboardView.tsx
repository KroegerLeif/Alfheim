"use client";

import { useTodayChores, useChoreTemplates, useChoreSummary } from "../services/choresService";
import { useShoppingIntegration, useMaintenanceIntegration } from "../services/integrationService";
import { ChoresList } from "./ChoresList";
import { GoalProgress } from "./GoalProgress";
import { ClipboardList, ShoppingCart, ShieldAlert, Calendar } from "lucide-react";
import { formatDate } from "@/core/utils";
import { useState } from "react";
import { useTranslation } from "@loeger-os/shared";

export function DashboardView() {
  const { t } = useTranslation();
  const todayStr = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const { data: chores = [], isLoading: choresLoading } = useTodayChores(selectedDate);
  const { data: templates = [], isLoading: templatesLoading } = useChoreTemplates();
  const { data: summary } = useChoreSummary();

  const { data: shoppingData, isLoading: shoppingLoading } = useShoppingIntegration();
  const { data: maintenanceData, isLoading: maintenanceLoading } = useMaintenanceIntegration();

  const handleDateChange = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    setSelectedDate(formatDate(d));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-[var(--text-main)] uppercase tracking-wide">
            {t("chores.dashboardTitle")}
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono uppercase mt-1">
            {t("chores.dashboardSubtitle")}
          </p>
        </div>

        {/* Date Selector tabs */}
        <div className="flex bg-[var(--surface-container)] border border-[var(--border-subtle)] p-1 rounded-lg select-none">
          <button
            onClick={() => handleDateChange(0)}
            className={`px-4 py-1.5 text-xs font-mono font-semibold uppercase rounded-md cursor-pointer ${
              selectedDate === todayStr
                ? "bg-[var(--primary-main)] text-black font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            {t("chores.today")}
          </button>
          <button
            onClick={() => handleDateChange(1)}
            className={`px-4 py-1.5 text-xs font-mono font-semibold uppercase rounded-md cursor-pointer ${
              selectedDate === formatDate(new Date(Date.now() + 86400000))
                ? "bg-[var(--primary-main)] text-black font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            {t("chores.tomorrow")}
          </button>
        </div>
      </div>

      {/* Goal Progress metrics widgets */}
      <GoalProgress summary={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns: Today's Chores List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 select-none">
            <ClipboardList className="h-4 w-4 text-[var(--primary-main)]" />
            <span className="font-mono text-xs uppercase font-bold text-[var(--text-main)]">
              {t("chores.scheduledChores")}
            </span>
          </div>

          {choresLoading || templatesLoading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary-main)] border-t-transparent"></div>
            </div>
          ) : (
            <ChoresList chores={chores} templates={templates} dueDate={selectedDate} />
          )}
        </div>

        {/* Right Column: Cross-App Integration Widgets */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 select-none">
            <Calendar className="h-4 w-4 text-[var(--primary-main)]" />
            <span className="font-mono text-xs uppercase font-bold text-[var(--text-main)]">
              {t("chores.systemIntegrations")}
            </span>
          </div>

          {/* Integration 1: Shopping list widget */}
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-5 flex flex-col justify-between h-[130px] rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider">
                  {t("chores.shoppingSync")}
                </span>
              </div>
              {shoppingLoading ? (
                <span className="text-[10px] font-mono bg-emerald-950/20 border border-emerald-800/40 text-emerald-400 px-2 py-0.5 rounded animate-pulse">
                  ...
                </span>
              ) : (
                <span className="text-[10px] font-mono bg-emerald-950/20 border border-emerald-800/40 text-emerald-400 px-2 py-0.5 rounded font-bold">
                  {shoppingData?.pendingCount !== undefined ? `${shoppingData.pendingCount} OFFEN` : t("chores.connected")}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {shoppingLoading
                ? "Lade Einkaufsdaten..."
                : shoppingData
                ? `${shoppingData.pendingCount} offene Artikel auf ${shoppingData.totalLists} Einkaufslisten.`
                : t("chores.shoppingSyncDesc")}
            </p>
          </div>

          {/* Integration 2: Maintenance alarm alert widget */}
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-5 flex flex-col justify-between h-[130px] rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider">
                  {t("chores.deviceMaintenance")}
                </span>
              </div>
              {maintenanceLoading ? (
                <span className="text-[10px] font-mono bg-amber-950/20 border border-amber-800/40 text-amber-400 px-2 py-0.5 rounded animate-pulse">
                  ...
                </span>
              ) : (
                <span
                  className={`text-[10px] font-mono border px-2 py-0.5 rounded font-bold ${
                    (maintenanceData?.dueCount || 0) > 0
                      ? "bg-amber-950/20 border-amber-800/40 text-amber-400"
                      : "bg-emerald-950/20 border-emerald-800/40 text-emerald-400"
                  }`}
                >
                  {(maintenanceData?.dueCount || 0) > 0
                    ? `! ${maintenanceData?.dueCount} FÄLLIG`
                    : t("chores.secured")}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {maintenanceLoading
                ? "Lade Wartungsdaten..."
                : maintenanceData
                ? `${maintenanceData.dueCount} fällige Wartungen bei ${maintenanceData.totalDevices} überwachten Geräten.`
                : t("chores.deviceMaintenanceDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
