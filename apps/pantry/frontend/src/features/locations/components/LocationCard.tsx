"use client";

import { useTranslation } from "@loeger-os/shared";
import { MapPin, Clock, AlertTriangle } from "lucide-react";
import { LocationRead } from "@/features/locations/types";

interface LocationCardProps {
  location: LocationRead;
  expiredCount: number;
  knappCount: number;
}

/**
 * LocationCard
 * Displays a single storage location with expiration and low-stock alarm badges.
 */
export function LocationCard({ location, expiredCount, knappCount }: LocationCardProps) {
  const { t } = useTranslation();

  return (
    <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-accent)] p-6 flex flex-col justify-between gap-6 transition-all rounded-lg shadow-sm">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-heading text-2xl font-bold uppercase tracking-wide leading-none truncate max-w-[200px] text-[var(--text-main)]">{location.name}</h3>
          <MapPin className="h-4 w-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
        </div>
        {location.is_system && (
          <span className="inline-block text-[8px] font-bold tracking-wider px-1 py-0.5 border border-[var(--border-subtle)] text-[var(--text-muted)] uppercase rounded">
            {t("pantry.systemLocation")}
          </span>
        )}
        <p className="text-[10px] text-[var(--text-muted)] uppercase leading-relaxed line-clamp-2 font-sans">{location.description ?? "—"}</p>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-subtle)]">
        {expiredCount === 0 && knappCount === 0 ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 select-none rounded">
            {t("pantry.ok")}
          </span>
        ) : (
          <>
            {expiredCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-red-800/40 bg-red-950/20 text-red-400 select-none rounded">
                <Clock className="h-3 w-3 shrink-0" />{expiredCount} {t("pantry.mhd")}
              </span>
            )}
            {knappCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-1 uppercase tracking-wide border border-amber-800/40 bg-amber-950/20 text-amber-400 select-none rounded">
                <AlertTriangle className="h-3 w-3 shrink-0" />{knappCount} {t("pantry.knapp")}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
