"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  useTranslation,
} from "@alfheim/shared";
import { Loader2 } from "lucide-react";
import { describeApiError } from "@/core/apiError";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { LocationRead } from "../types";
import { useUpdateLocation } from "../services/locationService";

interface LocationEditDialogProps {
  location: LocationRead;
  onClose: () => void;
}

const FIELD =
  "w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono";

/**
 * LocationEditDialog
 * Edits the name and description of a custom storage location.
 */
export function LocationEditDialog({ location, onClose }: LocationEditDialogProps) {
  const { t } = useTranslation();
  const updateLocationMut = useUpdateLocation();
  const [name, setName] = React.useState(location.name);
  const [description, setDescription] = React.useState(location.description ?? "");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrorMessage(t("pantry.locationNameRequired")); return; }
    setErrorMessage(null);
    updateLocationMut.mutate(
      { id: location.id, payload: { name: name.trim(), description: description.trim() || null } },
      {
        onSuccess: onClose,
        onError: async (error) => setErrorMessage(await describeApiError(error, t, "pantry.errors.updateLocationFailed")),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]">
        <DialogHeader>
          <DialogTitle>{t("pantry.edit.locationTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && <ErrorBanner message={errorMessage} />}
          <div className="space-y-1">
            <label htmlFor="edit-location-name" className="text-xs font-bold uppercase block">{t("pantry.locationName")} *</label>
            <input id="edit-location-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-location-description" className="text-xs font-bold uppercase block">{t("pantry.locationDesc")}</label>
            <textarea id="edit-location-description" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={3} maxLength={500} className={`${FIELD} resize-none`} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={updateLocationMut.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={updateLocationMut.isPending}>
              {updateLocationMut.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />{t("common.saving")}</> : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
