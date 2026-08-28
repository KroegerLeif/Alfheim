"use client";

import { Card, CardContent, CardHeader, CardTitle, Skeleton, useTranslation } from "@alfheim/shared";
import { useStreaks } from "../hooks/useAnalytics";

interface StreakStatProps {
  label: string;
  value: string;
  isLoading: boolean;
}

function StreakStat({ label, value, isLoading }: StreakStatProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className="font-heading text-3xl font-black text-[var(--primary-main)]">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Current and longest consecutive-day completed-session streaks for the
 * caller. Two compact stat cards rather than one combined card so each
 * number keeps its own accessible heading.
 */
export function StreakPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useStreaks();

  const current = data?.current_streak_days ?? 0;
  const longest = data?.longest_streak_days ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4">
      <StreakStat
        label={t("workout.currentStreak")}
        value={t("workout.streakDays", { count: current })}
        isLoading={isLoading}
      />
      <StreakStat
        label={t("workout.longestStreak")}
        value={t("workout.streakDays", { count: longest })}
        isLoading={isLoading}
      />
    </div>
  );
}
