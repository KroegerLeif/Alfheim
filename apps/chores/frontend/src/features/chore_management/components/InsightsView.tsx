"use client";

import { useTodayChores, useChoreSummary } from "../services/choresService";
import { GoalDonutChart } from "./GoalDonutChart";
import { Award, TrendingUp, Info } from "lucide-react";
import { useTranslation } from "@alfheim/shared";

export function InsightsView() {
  const { t } = useTranslation();
  const { data: summary } = useChoreSummary();
  const { data: todayChores = [] } = useTodayChores();

  const getBadges = (streakCount: number) => {
    const badges = [];
    if (streakCount >= 30) {
      badges.push({ name: t("chores.legendBadge"), desc: t("chores.legendDesc"), color: "border-purple-800 bg-purple-950/20 text-purple-400" });
    }
    if (streakCount >= 7) {
      badges.push({ name: t("chores.masterBadge"), desc: t("chores.masterDesc"), color: "border-amber-800 bg-amber-950/20 text-amber-400" });
    }
    if (streakCount >= 3) {
      badges.push({ name: t("chores.builderBadge"), desc: t("chores.builderDesc"), color: "border-blue-800 bg-blue-950/20 text-blue-400" });
    }
    if (badges.length === 0) {
      badges.push({ name: t("chores.freshStartBadge"), desc: t("chores.freshStartDesc"), color: "border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-muted)]" });
    }
    return badges;
  };

  const streak = summary?.longest_streak || 0;
  const earnedBadges = getBadges(streak);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="select-none">
        <h1 className="font-heading text-3xl font-extrabold text-[var(--text-main)] uppercase tracking-wide">
          {t("chores.insightsTitle")}
        </h1>
        <p className="text-xs text-[var(--text-muted)] font-mono uppercase mt-1">
          {t("chores.insightsSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: Category Distribution */}
        <GoalDonutChart chores={todayChores} />

        {/* Right Side: Achievements Badges */}
        <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 flex flex-col justify-between h-[280px] rounded-lg">
          <div>
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3 mb-4 select-none">
              <Award className="h-4 w-4 text-[var(--primary-main)]" />
              <span className="font-mono text-xs uppercase font-bold text-[var(--text-main)]">
                {t("chores.householdAchievements")}
              </span>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[170px] pr-1">
              {earnedBadges.map((badge, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 border rounded ${badge.color}`}
                >
                  <TrendingUp className="h-5 w-5 shrink-0" />
                  <div>
                    <span className="text-xs font-mono font-bold block">{badge.name}</span>
                    <span className="text-[10px] block mt-0.5">{badge.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Summary Info Box */}
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] p-5 flex items-start gap-3 rounded-lg">
        <Info className="h-5 w-5 text-[var(--primary-main)] mt-0.5 shrink-0" />
        <div className="text-xs leading-relaxed text-[var(--text-muted)]">
          <span className="font-bold text-[var(--text-main)] uppercase font-mono block mb-1">
            {t("chores.streaksWarningTitle")}
          </span>
          {t("chores.streaksWarningDesc")}
        </div>
      </div>
    </div>
  );
}
