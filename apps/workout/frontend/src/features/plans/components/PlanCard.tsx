"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, useTranslation } from "@alfheim/shared";
import { Calendar, Dumbbell, Play, Settings, Users } from "lucide-react";
import { Link } from "@/navigation";
import type { PlanRead } from "../types";
import { dayDisplayLabel } from "../utils";

interface PlanCardProps {
  plan: PlanRead;
  /** Starts a session from one day of the plan. Omit to hide the start buttons. */
  onStartSession?: (planId: string, dayId: string) => void;
  isStarting?: boolean;
}

export function PlanCard({ plan, onStartSession, isStarting }: PlanCardProps) {
  const { t } = useTranslation();

  const days = plan.days ?? [];

  return (
    <Card className="flex min-w-0 flex-col justify-between transition-all hover:border-[var(--primary-main)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="break-words text-lg font-bold">{plan.name}</CardTitle>
            {plan.description && (
              <p className="mt-1 line-clamp-2 break-words text-xs text-[var(--text-muted)]">
                {plan.description}
              </p>
            )}
          </div>
          <Badge variant={plan.is_shared ? "secondary" : "outline"} className="shrink-0 text-[10px]">
            {plan.is_shared ? (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" aria-hidden="true" />
                {t("workout.sharedPlan")}
              </span>
            ) : (
              t("workout.privatePlan")
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <Calendar className="h-3.5 w-3.5 text-[var(--primary-main)]" aria-hidden="true" />
            <span>
              {days.length} {t("workout.daysCount")}
            </span>
          </div>

          {days.length === 0 ? (
            <span className="text-xs italic text-[var(--text-muted)]">{t("workout.noDays")}</span>
          ) : (
            <ul className="space-y-1.5">
              {days.map((day, index) => {
                const label = dayDisplayLabel(day.label, index + 1, t);
                return (
                  <li
                    key={day.id}
                    className="flex items-center justify-between gap-2 rounded bg-[var(--surface-elevated)] px-2 py-1"
                  >
                    <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-[var(--text-primary)]">
                      <Dumbbell className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                      <span className="truncate" title={label}>
                        {label}
                      </span>
                      <span className="shrink-0">({(day.exercises ?? []).length})</span>
                    </span>
                    {onStartSession && (
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={isStarting}
                        aria-label={t("workout.startDay", { label })}
                        onClick={() => onStartSession(plan.id, day.id)}
                      >
                        <Play className="fill-current" aria-hidden="true" />
                        {t("workout.start")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-2">
          <Button variant="outline" size="sm" asChild className="w-full">
            <Link href={`/plans/${plan.id}`}>
              <Settings aria-hidden="true" />
              {t("workout.editPlan")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
