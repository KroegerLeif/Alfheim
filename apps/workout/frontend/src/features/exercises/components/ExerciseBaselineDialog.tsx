"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  useTranslation,
} from "@alfheim/shared";
import { Loader2 } from "lucide-react";
import { useExercisePreference, useUpsertExercisePreference } from "../hooks/useExercises";
import type { ExerciseRead } from "../types";

interface ExerciseBaselineDialogProps {
  exercise: ExerciseRead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lets the caller set `default_target_weight_kg` for one exercise.
 *
 * This is the value the plan weight-engine's `default`/`offset` target-weight
 * modes resolve against when a session is generated from a plan.
 */
export function ExerciseBaselineDialog({ exercise, open, onOpenChange }: ExerciseBaselineDialogProps) {
  const { t } = useTranslation();
  const [weight, setWeight] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const preferenceQuery = useExercisePreference(exercise?.id ?? "");
  const upsertMutation = useUpsertExercisePreference();

  React.useEffect(() => {
    if (open) {
      const current = preferenceQuery.data?.default_target_weight_kg;
      setWeight(current !== undefined && current !== null ? String(current) : "");
      setErrorMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preferenceQuery.data]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!exercise) return;
    setErrorMessage(null);

    const parsed = weight.trim() === "" ? null : Number(weight);
    if (parsed !== null && Number.isNaN(parsed)) {
      setErrorMessage(t("workout.saveFailed"));
      return;
    }

    upsertMutation.mutate(
      { id: exercise.id, payload: { default_target_weight_kg: parsed } },
      {
        onSuccess: () => onOpenChange(false),
        onError: (error) => setErrorMessage(error.message || t("workout.saveFailed")),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] p-6">
        <DialogHeader>
          <DialogTitle>{t("workout.setBaseline")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field htmlFor="baseline-weight" label={t("workout.defaultWeight")} error={errorMessage}>
            <Input
              id="baseline-weight"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={weight}
              onChange={(event) => {
                setWeight(event.target.value);
                setErrorMessage(null);
              }}
              aria-describedby={errorMessage ? "baseline-weight-error" : undefined}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={upsertMutation.isPending} className="min-h-11 flex-1">
              {upsertMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t("workout.save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onOpenChange(false)}
            >
              {t("workout.cancel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
