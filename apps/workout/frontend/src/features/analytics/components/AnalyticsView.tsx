"use client";

import { EmptyState, Skeleton, Spinner, useTranslation } from "@alfheim/shared";
import { BarChart3 } from "lucide-react";
import { useLeaderboard, useMuscleVolume, useStreaks } from "../hooks/useAnalytics";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { MuscleVolumePanel } from "./MuscleVolumePanel";
import { StreakPanel } from "./StreakPanel";

/**
 * Orchestrates the analytics page: loading/error/empty states plus the
 * streak, muscle-volume, and leaderboard panels. Presentation for each metric
 * lives in its own child component.
 */
export function AnalyticsView() {
  const { t } = useTranslation();

  const muscleVolumeQuery = useMuscleVolume();
  const streaksQuery = useStreaks();
  const leaderboardQuery = useLeaderboard();

  const isError = muscleVolumeQuery.isError || streaksQuery.isError || leaderboardQuery.isError;
  const isLoading = !isError && (muscleVolumeQuery.isLoading || streaksQuery.isLoading || leaderboardQuery.isLoading);

  const volumeEntries = muscleVolumeQuery.data?.entries ?? [];
  const leaderboardEntries = leaderboardQuery.data?.entries ?? [];
  const isEmpty = !isLoading && !isError && volumeEntries.length === 0 && leaderboardEntries.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-black uppercase tracking-wide md:text-3xl">
          {t("workout.analyticsTitle")}
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {t("workout.analyticsSubtitle")}
        </p>
      </header>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-xs font-bold uppercase text-red-400"
        >
          {t("workout.loadFailed")}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Spinner label={t("workout.loading")} className="mx-auto" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title={t("workout.noAnalyticsData")}
          description={t("workout.noAnalyticsDataSubtitle")}
        />
      ) : (
        <section aria-labelledby="analytics-results-heading">
          {/*
           * Card's title renders an <h3>. Without this intervening <h2> the
           * page would jump straight from the <h1> above to those <h3>s,
           * which fails axe's heading-order rule.
           */}
          <h2 id="analytics-results-heading" className="sr-only">
            {t("workout.analyticsTitle")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <StreakPanel />
            </div>
            <div className="md:col-span-1 lg:col-span-2">
              <MuscleVolumePanel />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <LeaderboardPanel />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
