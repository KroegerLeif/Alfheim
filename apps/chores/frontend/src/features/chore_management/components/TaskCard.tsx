"use client";

import { ChoreTemplateRead } from "../types";
import { useDeleteChoreTemplate } from "../services/choresService";
import { Award, RefreshCw, Trash2, Calendar } from "lucide-react";

interface TaskCardProps {
  template: ChoreTemplateRead;
}

export function TaskCard({ template }: TaskCardProps) {
  const deleteMutation = useDeleteChoreTemplate();

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete chore "${template.name}"?`)) {
      deleteMutation.mutate(template.id);
    }
  };

  const getPriorityColor = (points: number) => {
    if (points >= 30) return "border-red-800 bg-red-950/20 text-red-400";
    if (points >= 15) return "border-amber-800 bg-amber-950/20 text-amber-400";
    return "border-blue-800 bg-blue-950/20 text-blue-400";
  };

  const getPriorityLabel = (points: number) => {
    if (points >= 30) return "High Priority";
    if (points >= 15) return "Medium Priority";
    return "Standard Priority";
  };

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-all p-5 flex flex-col justify-between min-h-[160px] rounded-lg">
      <div>
        <div className="flex items-start justify-between">
          <h3 className="font-heading text-lg font-bold text-[var(--text-main)] truncate max-w-[200px]">
            {template.name}
          </h3>
          <button
            onClick={handleDelete}
            className="text-[var(--text-muted)] hover:text-red-500 cursor-pointer p-1 transition-colors"
            title="Delete template"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {template.description ? (
          <p className="text-xs text-[var(--text-muted)] mt-2 line-clamp-2">
            {template.description}
          </p>
        ) : (
          <p className="text-xs italic text-[var(--text-muted)] mt-2">
            No description provided.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {/* Recurrence Indicator */}
        <div className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 border border-[var(--border-subtle)] bg-[var(--surface-elevated)] rounded text-[var(--text-muted)]">
          <Calendar className="h-3 w-3" />
          <span>Daily</span>
        </div>

        {/* Reset Rule Tag */}
        <div className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 border border-[var(--border-subtle)] bg-[var(--surface-elevated)] rounded text-[var(--text-muted)]">
          <RefreshCw className="h-3 w-3" />
          <span>{template.is_non_cumulative ? "Auto-reset" : "Cumulative"}</span>
        </div>

        {/* Priority / Points Tag */}
        <div className={`flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 border rounded ${getPriorityColor(template.points)}`}>
          <Award className="h-3 w-3" />
          <span>{template.points} pts</span>
        </div>
      </div>
    </div>
  );
}
