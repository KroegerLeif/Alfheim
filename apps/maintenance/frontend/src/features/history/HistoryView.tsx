"use client";

import React from "react";
import { useLayout } from "@/shared/layout/LayoutContext";
import { useQuery } from "@tanstack/react-query";
import { getDevices } from "@/shared/api";
import { Device, ServiceHistoryEvent } from "@/shared/types";
import { formatDate } from "@/shared/utils";
import { History, Info, Loader2 } from "lucide-react";

interface FlattenedHistory {
  event: ServiceHistoryEvent;
  device: Device;
}

export function HistoryView() {
  const { householdId } = useLayout();

  // Fetch devices dynamically
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices", householdId],
    queryFn: () => getDevices(householdId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-cyan-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Flatten and aggregate history events
  const historyEvents: FlattenedHistory[] = [];
  devices.forEach((device) => {
    if (device.history_events) {
      device.history_events.forEach((event) => {
        historyEvents.push({ event, device });
      });
    }
  });

  // Sort by date in descending order (newest first)
  historyEvents.sort((a, b) => b.event.date.localeCompare(a.event.date));

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto font-sans text-white">
      
      {/* Title Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
        <History className="h-5 w-5 text-cyan-400" />
        <span className="text-xs font-black uppercase tracking-widest text-cyan-400">
          Service History Logs //
        </span>
      </div>

      {/* History Timeline Stream */}
      {historyEvents.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/10 p-12 text-center max-w-md mx-auto space-y-4">
          <Info className="h-10 w-10 text-cyan-400 mx-auto" />
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">No History Found</h3>
          <p className="text-sm text-slate-400">
            There are no previous service operations logged for this location.
          </p>
        </div>
      ) : (
        <div className="relative border-l border-white/5 pl-6 ml-4 space-y-8 py-2">
          {historyEvents.map(({ event, device }) => {
            const eventTitle = event.completed_steps && event.completed_steps.length > 0
              ? `Completed: ${event.completed_steps.join(", ")}`
              : "Maintenance Service";

            return (
              <div key={event.id} className="relative space-y-2.5">
                {/* Timeline Dot Indicator */}
                <div className="absolute -left-[30px] top-1.5 h-3.5 w-3.5 rounded-full bg-cyan-500 border-2 border-slate-950 ring-4 ring-cyan-500/10 shrink-0" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                      {eventTitle}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      <span>{formatDate(event.date)}</span>
                      <span>•</span>
                      <span>By {event.performer}</span>
                      <span>•</span>
                      <span className="text-cyan-400 font-bold">{device.name}</span>
                      <span>({device.location})</span>
                    </div>
                  </div>
                </div>

                {/* Notes Block */}
                {event.notes && (
                  <p className="text-xs text-slate-400 leading-relaxed italic bg-white/5 p-3 rounded-xl border border-white/5 max-w-2xl font-mono">
                    "{event.notes}"
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
