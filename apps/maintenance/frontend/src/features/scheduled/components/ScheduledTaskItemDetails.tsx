"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Device, MaintenanceStep } from "@/shared/types";
import { formatDate } from "@/core/utils";
import { FileText, Camera, Save, Loader2 } from "lucide-react";
import { cn } from "@/core/utils";

interface ScheduledTaskItemDetailsProps {
  step: MaintenanceStep;
  device: Device;
  comment: string;
  setComment: (c: string) => void;
  photo: string | null;
  handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSaveComment: () => void;
  isPending: boolean;
  isError: boolean;
  savedFlash: boolean;
}

export function ScheduledTaskItemDetails({
  step,
  device,
  comment,
  setComment,
  photo,
  handlePhotoChange,
  handleSaveComment,
  isPending,
  isError,
  savedFlash,
}: ScheduledTaskItemDetailsProps) {
  const t = useTranslations("maintenance");

  return (
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
          {isError && (
            <p className="text-[9px] text-red-500 font-mono">{t("scheduledTasks.saveFailed")}</p>
          )}
          {!isError && <span />}
          <button
            type="button"
            onClick={handleSaveComment}
            disabled={isPending}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer",
              savedFlash
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : isPending
                ? "bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)] cursor-wait"
                : "bg-[var(--primary-main)]/10 text-[var(--primary-main)] border-[var(--primary-main)]/30 hover:bg-[var(--primary-main)]/20"
            )}
          >
            {isPending ? (
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
  );
}
