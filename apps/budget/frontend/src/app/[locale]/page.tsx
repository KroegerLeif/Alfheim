"use client";

import React, { useState } from "react";
import { DesktopSidebar, MobileTabBar } from "@/features/navigation";

export default function BudgetHomePage() {
  const [activeTab, setActiveTab] = useState<string>("/");
  const [planningMode, setPlanningMode] = useState<"monthly" | "event">("monthly");
  const [quickAddCount, setQuickAddCount] = useState(0);

  const getMobileActiveTab = () => {
    if (activeTab === "/planning") return "planning";
    if (activeTab === "/pots") return "pots";
    return "dashboard";
  };

  return (
    <div className="flex min-h-screen bg-[var(--surface-canvas)]">
      {/* Desktop Navigation */}
      <DesktopSidebar
        currentPath={activeTab}
        planningMode={planningMode}
        onPlanningModeChange={setPlanningMode}
        onQuickAdd={() => setQuickAddCount((c) => c + 1)}
        onTabChange={(path) => setActiveTab(path)}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-6 pb-24 md:pb-6">
        <h1 className="text-2xl font-bold text-[var(--text-main)]">Budget & Treasury</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Manage your accounts, virtual pots, budget allocations, and transactions.
        </p>

        <div className="mt-6 p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-2">
          <p className="text-sm">
            <strong>Active Path:</strong> {activeTab}
          </p>
          <p className="text-sm">
            <strong>Planning Mode:</strong> {planningMode}
          </p>
          <p className="text-sm">
            <strong>Quick-Add Click Count:</strong> {quickAddCount}
          </p>
        </div>
      </main>

      {/* Mobile Navigation */}
      <MobileTabBar
        activeTab={getMobileActiveTab()}
        planningMode={planningMode}
        onPlanningModeChange={setPlanningMode}
        onTabChange={(tab) => setActiveTab(tab === "planning" ? "/planning" : tab === "pots" ? "/pots" : "/")}
        onQuickAdd={() => setQuickAddCount((c) => c + 1)}
      />
    </div>
  );
}
