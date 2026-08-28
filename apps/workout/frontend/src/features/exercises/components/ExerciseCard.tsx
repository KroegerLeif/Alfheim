"use client";

import { Badge, Button, Card, CardContent, useTranslation } from "@alfheim/shared";
import { Star, Target, Trash2 } from "lucide-react";
import type { ExerciseRead, ExerciseScope } from "../types";
import { isEditableExercise, MUSCLE_GROUP_LABEL_KEYS } from "../types";

const SCOPE_LABEL_KEYS: Record<ExerciseScope, string> = {
  system: "workout.scopeSystem",
  household: "workout.scopeHousehold",
  user: "workout.scopeUser",
};

interface ExerciseCardProps {
  exercise: ExerciseRead;
  isFavorite: boolean;
  onToggleFavorite: (exercise: ExerciseRead) => void;
  isTogglingFavorite?: boolean;
  onSetBaseline: (exercise: ExerciseRead) => void;
  onDelete: (exercise: ExerciseRead) => void;
  isDeleting?: boolean;
}

export function ExerciseCard({
  exercise,
  isFavorite,
  onToggleFavorite,
  isTogglingFavorite = false,
  onSetBaseline,
  onDelete,
  isDeleting = false,
}: ExerciseCardProps) {
  const { t } = useTranslation();
  const editable = isEditableExercise(exercise);

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 space-y-2">
          <h3 className="truncate font-heading text-base font-bold uppercase tracking-wide">
            {exercise.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t(MUSCLE_GROUP_LABEL_KEYS[exercise.primary_muscle])}</Badge>
            <Badge variant={exercise.scope === "system" ? "outline" : "secondary"}>
              {t(SCOPE_LABEL_KEYS[exercise.scope])}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            aria-label={t(isFavorite ? "workout.unfavorite" : "workout.favorite")}
            aria-pressed={isFavorite}
            disabled={isTogglingFavorite}
            onClick={() => onToggleFavorite(exercise)}
          >
            <Star
              aria-hidden="true"
              className={isFavorite ? "fill-[var(--primary-main)] text-[var(--primary-main)]" : undefined}
            />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            aria-label={`${t("workout.setBaseline")} ${exercise.name}`}
            onClick={() => onSetBaseline(exercise)}
          >
            <Target aria-hidden="true" />
          </Button>

          {editable && (
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label={`${t("workout.delete")} ${exercise.name}`}
              disabled={isDeleting}
              onClick={() => onDelete(exercise)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
