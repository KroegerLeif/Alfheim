"use client";

import { ChoreTemplateRead } from "../types";
import { useTaskTimeline } from "../services/choresService";
import { X, History, Award, User, Clock } from "lucide-react";
import { useTranslation } from "@alfheim/shared";

interface TaskTimelineModalProps {
  template: ChoreTemplateRead | null;
  onClose: () => void;
}

export function TaskTimelineModal({ template, onClose }: TaskTimelineModalProps) {
  const { t } = useTranslation();
  const { data: timeline = [], isLoading, isError } = useTaskTimeline(template?.id || "");

  if (!template) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-container)]">
          <div className="flex items-center gap-2.5">
            <History className="h-5 w-5 text-[var(--primary-main)]" />
            <div>
              <h2 className="font-heading text-lg font-bold text-[var(--text-main)]">
                {template.name}
              </h2>
              <p className="text-xs text-[var(--text-muted)] font-mono uppercase">
                {t("chores.timelineTitle") || "Completion History Audit"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {isError ? (
            <div className="py-8 text-center text-xs font-bold uppercase text-rose-400">
              Failed to load task timeline history.
            </div>
          ) : isLoading ? (
            <div className="py-12 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary-main)] border-t-transparent"></div>
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <Clock className="h-8 w-8 text-[var(--text-muted)] mx-auto opacity-50" />
              <p className="text-sm font-semibold text-[var(--text-main)]">
                {t("chores.noHistory") || "No completion history yet"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {t("chores.noHistorySub") || "Complete this chore on the dashboard to record your first timeline log."}
              </p>
            </div>
          ) : (
            <div className="relative border-l border-[var(--border-subtle)] ml-3 pl-6 space-y-6">
              {timeline.map((entry) => {
                const formattedDate = new Date(entry.completed_at).toLocaleString();
                return (
                  <div key={entry.id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-[var(--primary-main)] ring-4 ring-[var(--surface-card)]" />

                    <div className="bg-[var(--surface-container)] border border-[var(--border-subtle)] p-3.5 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]">
                          <User className="h-3.5 w-3.5 text-[var(--primary-main)]" />
                          <span>{entry.completed_by_name || entry.completed_by}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 border border-amber-800/40 bg-amber-950/20 text-amber-400 rounded">
                          <Award className="h-3 w-3" />
                          <span>+{entry.points_awarded} {t("chores.pts")}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] font-mono">
                        <Clock className="h-3 w-3" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
