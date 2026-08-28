"use client";

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
  useTranslation,
} from "@alfheim/shared";
import { Loader2, Plus } from "lucide-react";
import { useCreateExercise } from "../hooks/useExercises";
import type { ExerciseScope, MuscleGroup } from "../types";
import { MUSCLE_GROUP_LABEL_KEYS } from "../types";

const MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_LABEL_KEYS) as MuscleGroup[];

interface ExerciseCreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ExerciseCreateForm({ onSuccess, onCancel }: ExerciseCreateFormProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [primaryMuscle, setPrimaryMuscle] = React.useState<MuscleGroup>("chest");
  const [instructions, setInstructions] = React.useState("");
  const [scope, setScope] = React.useState<Exclude<ExerciseScope, "system">>("household");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const createMutation = useCreateExercise();

  const muscleOptions = MUSCLE_GROUPS.map((muscle) => ({
    value: muscle,
    label: t(MUSCLE_GROUP_LABEL_KEYS[muscle]),
  }));

  const scopeOptions = [
    { value: "household", label: t("workout.scopeHousehold") },
    { value: "user", label: t("workout.scopeUser") },
  ];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage(t("workout.exerciseNameRequired"));
      return;
    }

    createMutation.mutate(
      {
        name: name.trim(),
        primary_muscle: primaryMuscle,
        instructions: instructions.trim() || null,
        scope,
      },
      {
        onSuccess: () => {
          setName("");
          setInstructions("");
          onSuccess();
        },
        onError: (error) => setErrorMessage(error.message || t("workout.saveFailed")),
      }
    );
  };

  return (
    <Card className="max-w-xl">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field htmlFor="exercise-name" label={t("workout.exerciseName")} required error={errorMessage}>
            <Input
              id="exercise-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrorMessage(null);
              }}
              aria-describedby={errorMessage ? "exercise-name-error" : undefined}
              required
            />
          </Field>

          <Field htmlFor="exercise-primary-muscle" label={t("workout.primaryMuscle")}>
            <Select
              id="exercise-primary-muscle"
              options={muscleOptions}
              value={primaryMuscle}
              onChange={(event) => setPrimaryMuscle(event.target.value as MuscleGroup)}
            />
          </Field>

          <Field htmlFor="exercise-instructions" label={t("workout.instructions")}>
            <Textarea
              id="exercise-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
            />
          </Field>

          <Field htmlFor="exercise-scope" label={t("workout.scope")}>
            <Select
              id="exercise-scope"
              options={scopeOptions}
              value={scope}
              onChange={(event) => setScope(event.target.value as Exclude<ExerciseScope, "system">)}
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={createMutation.isPending} className="min-h-11 flex-1">
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              {t("workout.create")}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
              {t("workout.cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
