"use client";

import { ChoreIntegrationSummary } from "../types";
import { Award, Flame, CheckCircle } from "lucide-react";

interface GoalProgressProps {
  summary: ChoreIntegrationSummary | undefined;
}

export function GoalProgress({ summary }: GoalProgressProps) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Streak Dashboard Card */}
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-5 flex items-center justify-between rounded-lg">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider block">
            Household Streak
          </span>
          <span className="font-heading text-3xl font-extrabold text-[var(--text-main)] block mt-1">
            {summary.current_streak} Days
          </span>
          <span className="text-xs text-[var(--text-muted)] block mt-1 font-mono">
            Longest Record: {summary.longest_streak} Days
          </span>
        </div>
        <div className="h-12 w-12 bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center rounded-lg">
          <Flame className="h-6 w-6" />
        </div>
      </div>

      {/* Goal Progress bar Widget */}
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-5 flex flex-col justify-between rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
            Daily Goal Progress
          </span>
          <span className="text-xs font-mono font-bold text-[var(--primary-main)]">
            {summary.completion_rate}%
          </span>
        </div>
        <div className="w-full bg-[var(--surface-container)] h-3.5 mt-3 border border-[var(--border-subtle)] overflow-hidden rounded-full">
          <div
            className="bg-[var(--primary-main)] h-full transition-all duration-500 shadow-[0_0_8px_var(--accent-glow)]"
            style={{ width: `${summary.completion_rate}%` }}
          />
        </div>
        <span className="text-xs text-[var(--text-muted)] block mt-2 font-mono">
          {summary.today_completed_count} of {summary.today_total_count} tasks completed
        </span>
      </div>

      {/* Completion summary Widget */}
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-5 flex items-center justify-between rounded-lg">
        <div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider block">
            Outstanding Chores
          </span>
          <span className="font-heading text-3xl font-extrabold text-[var(--text-main)] block mt-1">
            {summary.today_pending_count} Left
          </span>
          <span className="text-xs text-[var(--text-muted)] block mt-1 font-mono">
            Focus points: {summary.today_pending_count * 10} potential pts
          </span>
        </div>
        <div className="h-12 w-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center rounded-lg">
          <CheckCircle className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
