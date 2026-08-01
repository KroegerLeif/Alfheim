"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Device, MaintenanceStep } from "@/shared/types";
import { formatDate, daysUntil } from "@/shared/utils";
import { updateTaskState } from "@/shared/api";
import { ChevronDown, Calendar, FileText, Camera, Save, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils";
import { useTranslations } from "next-intl";

interface ScheduledTaskItemProps {
  step: MaintenanceStep;
  device: Device;
}

export function ScheduledTaskItem({ step, device }: ScheduledTaskItemProps) {
  const t = useTranslations("maintenance");
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState(step.description ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const remainingDays = daysUntil(step.supply_needed_date || undefined);
  const isOverdue = remainingDays < 0;

  const mutation = useMutation({
    mutationFn: () =>
      updateTaskState(step.id, {
        comment: comment.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(e.target.files[0].name);
    }
  };

  const handleSaveComment = () => {
    if (!mutation.isPending) {
      mutation.mutate();
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
        <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-canvas)]/80 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-4 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <div className="space-y-0.5">
              <span>{t("deviceInventory.fields.nextDue")}</span>
              <span className="block text-[var(--text-main)] font-mono">{formatDate(step.supply_needed_date || undefined)}</span>
            </div>
            <div className="space-y-0.5">
              <span>{t("wizard.interval")}</span>
              <span className="block text-[var(--text-main)] font-mono">{t("deviceInventory.fields.intervalMonths", { count: step.recurrence })}</span>
            </div>
          </div>

          {/* Step procedure description */}
          {step.description && !comment && (
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              <strong>{t("scheduledTasks.procedureLabel")}</strong> {step.description}
            </p>
          )}

          {/* Comment textarea + Save button */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span>{t("scheduledTasks.commentLabel")}</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("scheduledTasks.commentPlaceholder")}
              className="w-full h-20 p-2.5 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-xs focus:outline-none resize-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
            />
            <div className="flex items-center justify-between">
              {mutation.isError && (
                <p className="text-[9px] text-red-500 font-mono">{t("scheduledTasks.saveFailed")}</p>
              )}
              {!mutation.isError && <span />}
              <button
                type="button"
                onClick={handleSaveComment}
                disabled={mutation.isPending}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer",
                  savedFlash
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : mutation.isPending
                    ? "bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)] cursor-wait"
                    : "bg-[var(--primary-main)]/10 text-[var(--primary-main)] border-[var(--primary-main)]/30 hover:bg-[var(--primary-main)]/20"
                )}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {savedFlash ? t("wizard.saved") : t("scheduledTasks.saveComment")}
              </button>
            </div>
          </div>

          {/* Photo attach stub */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" />
              <span>{t("scheduledTasks.referencePhoto")}</span>
            </span>
            <div className="flex items-center gap-3">
              <label className="px-4 py-2 bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl text-xs font-bold uppercase tracking-wider text-[var(--text-main)] transition-all cursor-pointer flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {t("scheduledTasks.chooseFile")}
              </label>
              <span className="text-xs text-[var(--text-muted)] font-mono truncate">
                {photo ?? t("scheduledTasks.noFileChosen")}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
