"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { MapPin, Clock, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { LocationRead } from "@/features/locations/types";
import { useDeleteLocation } from "../services/locationService";
import { LocationEditDialog } from "./LocationEditDialog";

interface LocationCardProps {
  location: LocationRead;
  expiredCount: number;
  knappCount: number;
}

/**
 * LocationCard
 * Displays a single storage location with expiration and low-stock alarm badges. Custom
 * locations can be edited and deleted; system locations are protected on the server.
 */
export function LocationCard({ location, expiredCount, knappCount }: LocationCardProps) {
  const { t } = useTranslation();
  const deleteLocationMut = useDeleteLocation();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  return (
    <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-accent)] p-6 flex flex-col justify-between gap-6 transition-all rounded-lg shadow-sm min-w-0">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4 min-w-0">
          <h3 className="font-heading text-2xl font-bold uppercase tracking-wide leading-none truncate min-w-0 text-[var(--text-main)]" title={location.name}>{location.name}</h3>
          <MapPin className="h-4 w-4 text-[var(--text-muted)] shrink-0 mt-0.5" aria-hidden="true" />
        </div>
        {location.is_system && (
          <span className="inline-block text-[8px] font-bold tracking-wider px-1 py-0.5 border border-[var(--border-subtle)] text-[var(--text-muted)] uppercase rounded">
            {t("pantry.systemLocation")}
          </span>
        )}
        <p className="text-[10px] text-[var(--text-muted)] uppercase leading-relaxed line-clamp-2 break-words font-sans" title={location.description ?? undefined}>{location.description ?? "—"}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
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
        {!location.is_system && (
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={() => setIsEditing(true)}
              className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-[var(--primary-main)] transition-colors cursor-pointer"
              aria-label={`${t("pantry.edit.location")}: ${location.name}`} title={t("pantry.edit.location")}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setIsDeleting(true)}
              className="p-1.5 rounded border border-[var(--border-subtle)] hover:border-red-500 hover:text-red-400 transition-colors cursor-pointer"
              aria-label={`${t("pantry.delete.location")}: ${location.name}`} title={t("pantry.delete.location")}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {isEditing && <LocationEditDialog location={location} onClose={() => setIsEditing(false)} />}
      <DeleteConfirmDialog
        open={isDeleting}
        onClose={() => setIsDeleting(false)}
        title={t("pantry.delete.locationTitle")}
        question={t("pantry.delete.locationQuestion")}
        name={location.name}
        onConfirm={() => deleteLocationMut.mutateAsync(location.id)}
        failureKey="pantry.errors.deleteLocationFailed"
        codeKeys={{ location_in_use: "pantry.errors.locationInUse" }}
      />
    </div>
  );
}
