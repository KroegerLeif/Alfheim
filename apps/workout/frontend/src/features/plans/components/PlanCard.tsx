"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, useTranslation } from "@alfheim/shared";
import { Calendar, Dumbbell, Play, Settings, Users } from "lucide-react";
import { Link, useRouter } from "@/navigation";
import type { PlanRead } from "../types";

interface PlanCardProps {
  plan: PlanRead;
  onStartSession?: (planId: string, dayId: string) => void;
  isStarting?: boolean;
}

export function PlanCard({ plan, onStartSession, isStarting }: PlanCardProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const days = plan.days ?? [];
  const firstDay = days[0];

  return (
    <Card className="flex flex-col justify-between transition-all hover:border-[var(--primary-main)]">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-bold">{plan.name}</CardTitle>
            {plan.description && (
              <p className="mt-1 text-xs text-[var(--text-muted)] line-clamp-2">
                {plan.description}
              </p>
            )}
          </div>
          <Badge variant={plan.is_shared ? "secondary" : "outline"} className="shrink-0 text-[10px]">
            {plan.is_shared ? (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
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
            <Calendar className="h-3.5 w-3.5 text-[var(--primary-main)]" />
            <span>{days.length} {t("workout.daysCount")}</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {days.length === 0 ? (
              <span className="text-xs text-[var(--text-muted)] italic">{t("workout.noDays")}</span>
            ) : (
              days.map((day) => (
                <span
                  key={day.id}
                  className="inline-flex items-center gap-1 rounded bg-[var(--surface-elevated)] px-2 py-0.5 text-xs font-mono text-[var(--text-primary)]"
                >
                  <Dumbbell className="h-3 w-3 opacity-60" />
                  {day.label} ({day.exercises.length})
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="flex-1"
          >
            <Link href={`/plans/${plan.id}`}>
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              {t("workout.editPlan")}
            </Link>
          </Button>

          {firstDay && onStartSession && (
            <Button
              size="sm"
              className="flex-1"
              disabled={isStarting}
              onClick={() => onStartSession(plan.id, firstDay.id)}
            >
              <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
              {t("workout.startSession")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
