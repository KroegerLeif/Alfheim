"use client";

import { useTranslation } from "@loeger-os/shared";
import { ChoreInstanceRead, ChoreTemplateRead } from "../types";
import { useCompleteChoreInstance, useAssignChoreInstance } from "../services/choresService";
import { CheckCircle2, Circle, User2, Award, RefreshCw } from "lucide-react";

interface ChoresListProps {
  chores: ChoreInstanceRead[];
  templates: ChoreTemplateRead[];
  dueDate?: string;
}

export function ChoresList({ chores = [], templates = [], dueDate }: ChoresListProps) {
  const { t } = useTranslation();
  const completeMutation = useCompleteChoreInstance();
  const assignMutation = useAssignChoreInstance();

  const getTemplate = (templateId: string) => {
    return templates.find((t) => t.id === templateId);
  };

  const handleComplete = (id: string, currentStatus: string) => {
    if (currentStatus === "completed") return;
    completeMutation.mutate({ id, dueDate });
  };

  const handleSelfAssign = (id: string, currentAssignee: string | null) => {
    // For demo purposes, we assign it to MOCK_USER_ID or toggle it
    const mockUserId = "00000000-0000-0000-0000-000000000001";
    const nextAssignee = currentAssignee ? null : mockUserId;
    assignMutation.mutate({ id, assignedTo: nextAssignee, dueDate });
  };

  if (chores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg">
        <RefreshCw className="h-8 w-8 text-[var(--text-muted)] animate-spin mb-3" />
        <p className="text-[var(--text-main)] font-semibold uppercase font-mono text-sm">
          {t("chores.noChoresToday")}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {t("chores.noChoresTodaySubtitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {chores.map((chore) => {
        const template = getTemplate(chore.template_id);
        const name = template?.name || "Unknown Chore";
        const points = template?.points || 10;
        const isCompleted = chore.status === "completed";

        return (
          <div
            key={chore.id}
            className={`flex items-center justify-between p-4 border transition-all rounded-lg select-none ${
              isCompleted
                ? "bg-[var(--surface-container)] border-emerald-800/40 text-[var(--text-muted)]"
                : "bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => handleComplete(chore.id, chore.status)}
                disabled={isCompleted}
                className={`cursor-pointer focus:outline-none transition-transform active:scale-95 ${
                  isCompleted ? "text-emerald-500" : "text-[var(--text-muted)] hover:text-[var(--primary-main)]"
                }`}
              >
                {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <span className={`text-sm font-semibold tracking-wide ${isCompleted ? "line-through" : ""}`}>
                  {name}
                </span>
                {template?.description && (
                  <p className="text-xs text-[var(--text-muted)] truncate max-w-md">
                    {template.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {/* Award Points Badge */}
              <div className="flex items-center gap-1 text-xs font-mono bg-[var(--surface-elevated)] px-2.5 py-1 border border-[var(--border-subtle)] text-[var(--text-main)] rounded">
                <Award className="h-3.5 w-3.5 text-amber-500" />
                <span>{points} {t("chores.pts")}</span>
              </div>

              {/* Assignment Avatar Trigger */}
              <button
                onClick={() => handleSelfAssign(chore.id, chore.assigned_to)}
                disabled={isCompleted}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs border rounded transition-colors ${
                  chore.assigned_to
                    ? "border-[var(--primary-main)] bg-[var(--primary-main)]/10 text-[var(--primary-main)]"
                    : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-accent)]"
                }`}
              >
                <User2 className="h-3.5 w-3.5" />
                <span className="font-mono">
                  {chore.assigned_to ? t("chores.assigned") : t("chores.claim")}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
