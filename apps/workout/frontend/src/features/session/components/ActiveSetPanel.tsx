"use client";

import * as React from "react";
import { Badge, Button, Card, CardContent, useTranslation } from "@alfheim/shared";
import { Check } from "lucide-react";
import type { SessionExerciseRead, SessionSetRead } from "../types";
import { SetStepper } from "./SetStepper";

interface ActiveSetPanelProps {
  exercise: SessionExerciseRead;
  set: SessionSetRead;
  setIndex: number;
  onLog: (reps: number, weightKg: number) => void;
  isLogging: boolean;
}

/**
 * The one set currently being performed. Pre-fills the steppers from the
 * backend-resolved targets so the common case is a single tap to confirm.
 */
export function ActiveSetPanel({
  exercise,
  set,
  setIndex,
  onLog,
  isLogging,
}: ActiveSetPanelProps) {
  const { t } = useTranslation();
  const [reps, setReps] = React.useState(set.target_reps ?? 0);
  const [weight, setWeight] = React.useState(set.target_weight_kg ?? 0);

  // Re-seed when the active set changes, so advancing does not carry the
  // previous set's edits over.
  React.useEffect(() => {
    setReps(set.target_reps ?? 0);
    setWeight(set.target_weight_kg ?? 0);
  }, [set.id, set.target_reps, set.target_weight_kg]);

  return (
    <Card className="border-[var(--border-accent)]">
      <CardContent className="space-y-5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-lg font-black uppercase tracking-wide">
              {exercise.exercise_name_snapshot}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
              {t("workout.setNumber", { number: setIndex + 1 })}
            </span>
          </div>
          {set.is_warmup && <Badge variant="outline">{t("workout.warmupSet")}</Badge>}
        </div>

        {set.target_weight_kg === null && (
          <p className="rounded border border-[var(--border-subtle)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            {t("workout.baselineMissing")}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SetStepper
            label={t("workout.reps")}
            value={reps}
            onChange={setReps}
            step={1}
            decrementLabel={`${t("workout.reps")} -1`}
            incrementLabel={`${t("workout.reps")} +1`}
          />
          <SetStepper
            label={t("workout.weight")}
            value={weight}
            onChange={setWeight}
            step={2.5}
            suffix={t("workout.unit_kg")}
            decrementLabel={`${t("workout.weight")} -2.5`}
            incrementLabel={`${t("workout.weight")} +2.5`}
          />
        </div>

        <Button
          type="button"
          className="h-14 w-full text-sm"
          disabled={isLogging}
          onClick={() => onLog(reps, weight)}
        >
          <Check aria-hidden="true" />
          {t("workout.logSet")}
        </Button>
      </CardContent>
    </Card>
  );
}
