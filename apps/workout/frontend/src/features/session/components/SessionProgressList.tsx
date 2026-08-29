"use client";

import { Badge, useTranslation } from "@alfheim/shared";
import { Check } from "lucide-react";
import { cn } from "@/core/utils";
import type { SessionExerciseRead } from "../types";
import { isSetCompleted } from "../types";

interface SessionProgressListProps {
  exercises: SessionExerciseRead[];
  activeExerciseId: string | null;
}

/**
 * Compact overview of the whole session. On desktop this sits beside the active
 * set; on mobile it stacks underneath so the HUD stays the first thing on screen.
 */
export function SessionProgressList({ exercises, activeExerciseId }: SessionProgressListProps) {
  const { t } = useTranslation();
  const safeExercises = exercises ?? [];

  if (safeExercises.length === 0) return null;

  return (
    <ol className="space-y-2">
      {safeExercises.map((exercise) => {
        const sets = exercise.sets ?? [];
        const done = sets.filter(isSetCompleted).length;
        const isActive = exercise.id === activeExerciseId;
        const isComplete = sets.length > 0 && done === sets.length;

        return (
          <li
            key={exercise.id}
            aria-current={isActive ? "step" : undefined}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
              isActive
                ? "border-[var(--border-accent)] bg-[var(--surface-elevated)]"
                : "border-[var(--border-subtle)] bg-[var(--surface-card)]"
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              {isComplete && (
                <Check className="h-4 w-4 shrink-0 text-[var(--primary-main)]" aria-hidden="true" />
              )}
              <span className="truncate font-mono text-xs uppercase tracking-wider">
                {exercise.exercise_name_snapshot}
              </span>
            </div>
            <Badge variant={isComplete ? "default" : "secondary"}>
              {done}/{sets.length}
            </Badge>
          </li>
        );
      })}
      <li className="sr-only">
        {t("workout.exerciseProgress", {
          current: safeExercises.findIndex((exercise) => exercise.id === activeExerciseId) + 1,
          total: safeExercises.length,
        })}
      </li>
    </ol>
  );
}
