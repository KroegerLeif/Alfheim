"use client";

import React from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { useQuery } from "@tanstack/react-query";
import { getServiceHistory } from "@/shared/api";
import { ServiceHistoryEventDetail } from "@/shared/types";
import { formatDate } from "@/shared/utils";
import { CheckCircle2, History, Info, Loader2 } from "lucide-react";

export function HistoryView() {
  const { householdId } = useLayout();

  const { data: events = [], isLoading, isError } = useQuery<ServiceHistoryEventDetail[]>({
    queryKey: ["serviceHistory", householdId],
    queryFn: () => getServiceHistory(householdId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-cyan-600 dark:text-cyan-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-red-500 dark:text-red-400">Failed to load service history. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans text-slate-900 dark:text-white">

      {/* Title Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-xs font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
            Service History Logs //
          </span>
        </div>
        {events.length > 0 && (
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {events.length} record{events.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* History Timeline Stream */}
      {events.length === 0 ? (
        <div className="bg-white border-slate-200 text-slate-900 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-100 rounded-2xl border p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
          <Info className="h-10 w-10 text-cyan-600 dark:text-cyan-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">No History Found</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            There are no previous service operations logged for this location.
          </p>
        </div>
      ) : (
        <div className="relative border-l border-slate-200 dark:border-slate-800 pl-6 ml-4 space-y-8 py-2">
          {events.map((event: ServiceHistoryEventDetail) => {
            const eventTitle =
              event.completed_steps && event.completed_steps.length > 0
                ? `Completed: ${event.completed_steps.join(", ")}`
                : "Maintenance Service";

            return (
              <div key={event.id} className="relative space-y-3">
                {/* Timeline Dot Indicator */}
                <div className="absolute -left-[30px] top-1.5 h-3.5 w-3.5 rounded-full bg-cyan-500 border-2 border-white dark:border-slate-950 ring-4 ring-cyan-500/10 shrink-0" />

                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                      {eventTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <span>{formatDate(event.date)}</span>
                      <span>•</span>
                      <span>By {event.performer}</span>
                      <span>•</span>
                      <span className="text-cyan-600 dark:text-cyan-400 font-bold">{event.device_name}</span>
                      <span>({event.device_location})</span>
                    </div>
                  </div>
                </div>

                {/* Completed Steps Chips */}
                {event.completed_steps && event.completed_steps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {event.completed_steps.map((step, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {step}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes Block */}
                {event.notes && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic bg-slate-100 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl font-mono">
                    &quot;{event.notes}&quot;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
