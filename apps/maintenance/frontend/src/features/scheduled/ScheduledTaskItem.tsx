"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Device, MaintenanceStep } from "@/shared/types";
import { formatDate, daysUntil } from "@/shared/utils";
import { updateTaskState } from "@/shared/api";
import { ChevronDown, Calendar, FileText, Camera, Save, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils";

interface ScheduledTaskItemProps {
  step: MaintenanceStep;
  device: Device;
}

export function ScheduledTaskItem({ step, device }: ScheduledTaskItemProps) {
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
    if (isOverdue) return `OVERDUE (${Math.abs(remainingDays)}d)`;
    if (remainingDays <= 14) return `DUE SOON (${remainingDays}d)`;
    return `GOOD (${remainingDays}d)`;
  };

  const getStatusBadgeClass = () => {
    if (isOverdue) return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    if (remainingDays <= 14) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  };

  return (
    <div className="bg-white border-slate-200 text-slate-900 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-100 rounded-2xl border transition-all duration-300 shadow-sm overflow-hidden">
      {/* Header Summary Row in 12-column CSS Grid */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 grid grid-cols-1 md:grid-cols-12 md:items-center gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
      >
        {/* Cols 1–5: Icon & Task Info */}
        <div className="col-span-12 md:col-span-5 flex items-center gap-4 min-w-0">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
            isOverdue
              ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
              : remainingDays <= 14
              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
              : "bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-cyan-600 dark:text-cyan-400"
          )}>
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide truncate">
              {step.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <span className="truncate text-slate-700 dark:text-slate-300">{device.name}</span>
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
          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Next Service Due</span>
          <span className="font-mono text-slate-800 dark:text-slate-300 font-bold">{formatDate(step.supply_needed_date || undefined)}</span>
        </div>

        {/* Cols 10–12: Expand / Action */}
        <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            {isExpanded ? "Hide Details" : "Show Details"}
            <ChevronDown className={cn("h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-300", isExpanded && "rotate-180")} />
          </span>
        </div>
      </button>

      {/* Accordion Expand Section */}
      {isExpanded && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <div className="space-y-0.5">
              <span>Next Due Date</span>
              <span className="block text-slate-800 dark:text-slate-300 font-mono">{formatDate(step.supply_needed_date || undefined)}</span>
            </div>
            <div className="space-y-0.5">
              <span>Service Interval</span>
              <span className="block text-slate-800 dark:text-slate-300 font-mono">{step.recurrence} Months</span>
            </div>
          </div>

          {/* Step procedure description */}
          {step.description && !comment && (
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>Procedure:</strong> {step.description}
            </p>
          )}

          {/* Comment textarea + Save button */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span>Inspection Comment</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add comments or status remarks about this task..."
              className="w-full h-20 p-2.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 focus:border-cyan-500/50 rounded-xl text-slate-900 dark:text-slate-200 text-xs focus:outline-none resize-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
            />
            <div className="flex items-center justify-between">
              {mutation.isError && (
                <p className="text-[9px] text-red-500 dark:text-red-400 font-mono">Save failed — try again.</p>
              )}
              {!mutation.isError && <span />}
              <button
                type="button"
                onClick={handleSaveComment}
                disabled={mutation.isPending}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer",
                  savedFlash
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : mutation.isPending
                    ? "bg-slate-100 text-slate-400 border-slate-200 dark:bg-white/5 dark:text-slate-500 dark:border-white/5 cursor-wait"
                    : "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20"
                )}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                {savedFlash ? "Saved!" : "Save Comment"}
              </button>
            </div>
          </div>

          {/* Photo attach stub */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" />
              <span>Reference Photo</span>
            </span>
            <div className="flex items-center gap-3">
              <label className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                Choose File
              </label>
              <span className="text-xs text-slate-500 font-mono truncate">
                {photo ?? "No file chosen"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
