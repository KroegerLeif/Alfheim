"use client";

import React, { useState } from "react";
import { Device, MaintenanceStep } from "@/shared/types";
import { formatDate, daysUntil } from "@/core/utils";
import { useUpdateTaskState } from "../hooks/useScheduled";
import { ChevronDown, Calendar } from "lucide-react";
import { cn } from "@/core/utils";
import { useTranslations } from "next-intl";
import { ScheduledTaskItemDetails } from "./ScheduledTaskItemDetails";

interface ScheduledTaskItemProps {
  step: MaintenanceStep;
  device: Device;
}

export function ScheduledTaskItem({ step, device }: ScheduledTaskItemProps) {
  const t = useTranslations("maintenance");
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState(step.description ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const remainingDays = daysUntil(step.supply_needed_date || undefined);
  const isOverdue = remainingDays < 0;

  // Use FDD custom mutation hook
  const mutation = useUpdateTaskState(step.id, () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0].name);
    }
  };

  const handleSaveComment = () => {
    if (!mutation.isPending) {
      mutation.mutate({
        comment: comment.trim() || null,
      });
    }
  };

  const getStatusBadgeText = () => {
    if (isOverdue) return t("scheduledTasks.overdueBadge", { days: Math.abs(remainingDays) });
    if (remainingDays <= 14) return t("scheduledTasks.dueSoonBadge", { days: remainingDays });
    return t("scheduledTasks.goodBadge", { days: remainingDays });
  };

  const getStatusBadgeClass = () => {
    if (isOverdue) return "bg-red-500/10 text-red-500 border-red-500/20";
    if (remainingDays <= 14) return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  };

  return (
    <div className="bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-main)] rounded-2xl border transition-all duration-300 shadow-sm overflow-hidden font-sans">
      {/* Header Summary Row in 12-column CSS Grid */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 grid grid-cols-1 md:grid-cols-12 md:items-center gap-4 text-left hover:bg-[var(--surface-canvas)] transition-colors cursor-pointer"
      >
        {/* Cols 1–5: Icon & Task Info */}
        <div className="col-span-12 md:col-span-5 flex items-center gap-4 min-w-0">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
            isOverdue
              ? "bg-red-500/10 border-red-500/20 text-red-500"
              : remainingDays <= 14
              ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
              : "bg-[var(--surface-canvas)] border-[var(--border-subtle)] text-[var(--primary-main)]"
          )}>
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[var(--text-main)] uppercase tracking-wide truncate">
              {step.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
              <span className="truncate text-[var(--text-main)]">{device.name}</span>
              <span>•</span>
              <span className="truncate">{device.location}</span>
            </div>
          </div>
        </div>

        {/* Cols 6–7: Status Badge */}
        <div className="col-span-6 md:col-span-2 flex items-center justify-start md:justify-center">
          <span className={cn("text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shrink-0", getStatusBadgeClass())}>
            {getStatusBadgeText()}
          </span>
        </div>

        {/* Cols 8–9: Next Service Due Date */}
        <div className="col-span-6 md:col-span-2 text-left md:text-center text-xs">
          <span className="block text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            {t("maintenanceWork.nextServiceDue")}
          </span>
          <span className="font-mono text-[var(--text-main)] font-bold">{formatDate(step.supply_needed_date || undefined)}</span>
        </div>

        {/* Cols 10–12: Expand / Action */}
        <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            {isExpanded ? t("scheduledTasks.hideDetails") : t("scheduledTasks.showDetails")}
            <ChevronDown className={cn("h-4 w-4 text-[var(--text-muted)] transition-transform duration-300", isExpanded && "rotate-180")} />
          </span>
        </div>
      </button>

      {/* Accordion Expand Section */}
      {isExpanded && (
        <ScheduledTaskItemDetails
          step={step}
          device={device}
          comment={comment}
          setComment={setComment}
          photo={photo}
          handlePhotoChange={handlePhotoChange}
          handleSaveComment={handleSaveComment}
          isPending={mutation.isPending}
          isError={mutation.isError}
          savedFlash={savedFlash}
        />
      )}
    </div>
  );
}
