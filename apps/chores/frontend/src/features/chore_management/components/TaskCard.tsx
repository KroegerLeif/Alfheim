"use client";

import { useState } from "react";
import { ChoreTemplateRead } from "../types";
import { useDeleteChoreTemplate } from "../services/choresService";
import { Award, RefreshCw, Trash2, Calendar, Check, X, History } from "lucide-react";
import { useTranslation } from "@alfheim/shared";
import { TaskTimelineModal } from "./TaskTimelineModal";

interface TaskCardProps {
  template: ChoreTemplateRead;
}

export function TaskCard({ template }: TaskCardProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteChoreTemplate();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const handleDelete = () => {
    deleteMutation.mutate(template.id);
  };

  const getPriorityColor = (points: number) => {
    if (points >= 30) return "border-red-800 bg-red-950/20 text-red-400";
    if (points >= 15) return "border-amber-800 bg-amber-950/20 text-amber-400";
    return "border-blue-800 bg-blue-950/20 text-blue-400";
  };

  return (
    <>
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all p-5 flex flex-col justify-between min-h-[160px] rounded-lg">
        <div>
          <div className="flex items-start justify-between">
            <h3 className="font-heading text-lg font-bold text-[var(--text-main)] truncate max-w-[180px]">
              {template.name}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowTimeline(true)}
                className="text-[var(--text-muted)] hover:text-[var(--primary-main)] cursor-pointer p-1 transition-colors"
                title={t("chores.timeline") || "Completion History"}
              >
                <History className="h-4 w-4" />
              </button>
              {showConfirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                    title={t("chores.deleteTemplate")}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setShowConfirmDelete(false)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-[var(--text-muted)] hover:text-red-500 cursor-pointer p-1 transition-colors"
                  title={t("chores.deleteTemplate")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

        {template.description ? (
          <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-2">
            {template.description}
          </p>
        ) : (
          <p className="text-xs italic text-[var(--text-muted)] mt-2">
            {t("chores.noDescription")}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Recurrence Indicator */}
        <div className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 border border-[var(--border-subtle)] bg-[var(--surface-elevated)] rounded text-[var(--text-muted)]">
          <Calendar className="h-3 w-3" />
          <span>{t("chores.daily")}</span>
        </div>

        {/* Reset Rule Tag */}
        <div className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 border border-[var(--border-subtle)] bg-[var(--surface-elevated)] rounded text-[var(--text-muted)]">
          <RefreshCw className="h-3 w-3" />
          <span>{template.is_non_cumulative ? t("chores.autoReset") : t("chores.cumulative")}</span>
        </div>

        {/* Priority / Points Tag */}
        <div className={`flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 border rounded ${getPriorityColor(template.points)}`}>
          <Award className="h-3 w-3" />
          <span>{template.points} {t("chores.pts")}</span>
        </div>
      </div>
    </div>

      {showTimeline && (
        <TaskTimelineModal
          template={template}
          onClose={() => setShowTimeline(false)}
        />
      )}
    </>
  );
}
