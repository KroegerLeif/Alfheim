"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { useCreateLocation } from "../services/locationService";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, AlertCircle } from "lucide-react";

interface LocationCreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * LocationCreateForm
 * Collapsible inline form to provision a new physical storage location.
 */
export function LocationCreateForm({ onSuccess, onCancel }: LocationCreateFormProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const createLocationMut = useCreateLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!name.trim()) { setErrorMessage(t("pantry.locationNameRequired")); return; }
    createLocationMut.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => { setName(""); setDescription(""); onSuccess(); },
        onError: (err: any) => setErrorMessage(err.message || t("pantry.createLocationFailed")),
      }
    );
  };

  return (
    <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 max-w-xl animate-in fade-in slide-in-from-top-4 duration-200 rounded-lg shadow-sm">
      <h2 className="text-xl font-heading font-black tracking-wide border-b border-[var(--border-subtle)] pb-2 mb-4 text-[var(--text-main)]">
        {t("pantry.createLocationTitle")}
      </h2>

      {errorMessage && (
        <div className="border border-red-800/40 bg-red-950/20 text-red-400 p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal mb-4 rounded">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="location-name" className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.locationName")} *</label>
          <input id="location-name" type="text" value={name}
            onChange={(e) => { setName(e.target.value); setErrorMessage(null); }}
            placeholder={t("pantry.locationNamePlaceholder")} required
            className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase font-mono rounded" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="location-description" className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.locationDesc")}</label>
          <textarea id="location-description" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("pantry.locationDescPlaceholder")} rows={3}
            className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm uppercase font-mono resize-none rounded" />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={createLocationMut.isPending}
            className="flex-1 py-6 text-xs font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--primary-main)] text-black hover:bg-[var(--primary-hover)] cursor-pointer select-none transition-all flex items-center justify-center gap-2 rounded-lg">
            {createLocationMut.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t("pantry.creatingLocation")}</>
            ) : (
              <><Plus className="h-4 w-4" />{t("pantry.submitLocation")}</>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="text-xs uppercase px-4">
            {t("pantry.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
