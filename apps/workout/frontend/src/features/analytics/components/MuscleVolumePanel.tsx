"use client";

import { Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton, useTranslation } from "@alfheim/shared";
import { BarChart3 } from "lucide-react";
import { MUSCLE_GROUP_LABEL_KEYS, type MuscleGroup } from "@/features/exercises/types";
import { useMuscleVolume } from "../hooks/useAnalytics";

/**
 * `primary_muscle` comes back from the API as a plain `string` (see
 * `MuscleVolumeEntry` in ../types), so the lookup into the `MuscleGroup`-keyed
 * label map needs a fallback for any value the frontend enum doesn't know
 * about yet.
 */
function muscleLabelKey(primaryMuscle: string): string {
  return MUSCLE_GROUP_LABEL_KEYS[primaryMuscle as MuscleGroup] ?? "workout.muscleFullBody";
}

/**
 * Per-muscle training volume rendered as a horizontal bar list. No charting
 * library — each bar's width is the entry's share of the largest entry.
 *
 * The bar list is exposed as a single `role="img"` element with an
 * `aria-label` summarizing every entry, since the individual bars are purely
 * decorative and would otherwise be unreadable to assistive technology.
 */
export function MuscleVolumePanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useMuscleVolume();

  const entries = data?.entries ?? [];
  const maxVolume = entries.reduce((max, entry) => Math.max(max, entry.total_volume_kg), 0);
  const unit = t("workout.unit_kg");

  const summary = entries
    .map((entry) => {
      const label = t(muscleLabelKey(entry.primary_muscle));
      return `${label}: ${entry.total_volume_kg} ${unit}`;
    })
    .join(", ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workout.muscleVolume")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-8 w-8" />} title={t("workout.noAnalyticsData")} />
        ) : (
          <div role="img" aria-label={summary} className="space-y-3">
            {entries.map((entry) => {
              const widthPercent = maxVolume > 0 ? (entry.total_volume_kg / maxVolume) * 100 : 0;
              const label = t(muscleLabelKey(entry.primary_muscle));

              return (
                <div key={entry.primary_muscle} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    <span>{label}</span>
                    <span>
                      {entry.total_volume_kg} {unit}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-[var(--surface-elevated)]">
                    <div
                      className="h-3 rounded-full bg-[var(--accent-cyan)]"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
