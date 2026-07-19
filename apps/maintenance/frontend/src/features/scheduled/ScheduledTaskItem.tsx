"use client";

import React, { useState } from "react";
import { Device, MaintenanceStep } from "@/shared/types";
import { formatDate, daysUntil } from "@/shared/utils";
import { ChevronDown, Calendar, FileText, Camera } from "lucide-react";
import { cn } from "@/shared/utils";

interface ScheduledTaskItemProps {
  step: MaintenanceStep;
  device: Device;
}

export function ScheduledTaskItem({ step, device }: ScheduledTaskItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  const remainingDays = daysUntil(step.supply_needed_date || undefined);
  const isOverdue = remainingDays < 0;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file.name);
    }
  };

  return (
    <div className="glass-card rounded-xl border border-white/5 overflow-hidden transition-all duration-300">
      {/* Header Summary Row */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border",
            isOverdue
              ? "bg-red-500/10 border-red-500/20 text-red-400"
              : remainingDays <= 14
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
              : "bg-white/5 border-white/5 text-cyan-400"
          )}>
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-white uppercase tracking-wide truncate">
              {step.title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              <span className="truncate text-slate-300">{device.name}</span>
              <span>•</span>
              <span className="truncate">{device.location}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <span className={cn(
            "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
            isOverdue
              ? "bg-red-500/10 text-red-400 border-red-500/20"
              : remainingDays <= 14
              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
              : "bg-white/5 text-slate-400 border-white/5"
          )}>
            {isOverdue ? `Overdue ${Math.abs(remainingDays)}d` : `In ${remainingDays}d`}
          </span>
          <ChevronDown className={cn("h-4.5 w-4.5 text-slate-500 transition-transform duration-300", isExpanded && "rotate-180")} />
        </div>
      </button>

      {/* Accordion Expand Section */}
      {isExpanded && (
        <div className="p-4 border-t border-white/5 bg-slate-950/40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 gap-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <div className="space-y-0.5">
              <span>Next Due Date</span>
              <span className="block text-slate-300 font-mono">{formatDate(step.supply_needed_date || undefined)}</span>
            </div>
            <div className="space-y-0.5">
              <span>Service Interval</span>
              <span className="block text-slate-300 font-mono">{step.recurrence} Months</span>
            </div>
          </div>

          {/* Description */}
          {step.description && (
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong>Procedure:</strong> {step.description}
            </p>
          )}

          {/* Comment text area */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span>Inspection Comment</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add comments or status remarks about this task..."
              className="w-full h-20 p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/30 rounded-xl text-slate-200 text-xs focus:outline-none resize-none transition-all placeholder:text-slate-600 font-mono"
            />
          </div>

          {/* Photo attach stub */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Camera className="h-3.5 w-3.5" />
              <span>Reference Photo</span>
            </span>
            <div className="flex items-center gap-3">
              <label className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                Choose File
              </label>
              <span className="text-xs text-slate-500 font-mono truncate">
                {photo ? photo : "No file chosen"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
