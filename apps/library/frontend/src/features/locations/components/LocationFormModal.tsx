import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useTranslation,
} from "@alfheim/shared";
import type {
  LocationCreatePayload,
  LocationNode,
  LocationUpdatePayload,
} from "../types";

interface LocationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationToEdit: LocationNode | null;
  defaultParentId: string | null;
  allLocations: LocationNode[];
  onSave: (
    payload: LocationCreatePayload | LocationUpdatePayload,
    id?: string
  ) => Promise<void>;
}

/**
 * Flatten the tree into select options labelled with their path. The location being edited and
 * everything below it are skipped, because moving a location under itself would create a cycle.
 */
function flattenTree(
  nodes: LocationNode[],
  excludedId: string | null
): { id: string; name: string }[] {
  const list: { id: string; name: string }[] = [];
  function traverse(items: LocationNode[], prefix = "") {
    for (const item of items) {
      if (item.id === excludedId) continue;
      const path = prefix ? `${prefix} / ${item.name}` : item.name;
      list.push({ id: item.id, name: path });
      traverse(item.children ?? [], path);
    }
  }
  traverse(nodes);
  return list;
}

export function LocationFormModal({
  isOpen,
  onClose,
  locationToEdit,
  defaultParentId,
  allLocations,
  onSave,
}: LocationFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (locationToEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(locationToEdit.name);
      setDescription(locationToEdit.description || "");
      setParentId(locationToEdit.parent_id || "");
    } else {
      setName("");
      setDescription("");
      setParentId(defaultParentId || "");
    }
    setError(null);
  }, [locationToEdit, defaultParentId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        parent_id: parentId || null,
      };

      if (locationToEdit) {
        await onSave(payload, locationToEdit.id);
      } else {
        await onSave(payload);
      }
      onClose();
    } catch {
      setError(t("library.locations.saveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const flatList = flattenTree(allLocations, locationToEdit?.id ?? null);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]">
        <DialogHeader>
          <DialogTitle>
            {locationToEdit
              ? t("library.locations.editTitle")
              : t("library.locations.createTitle")}
          </DialogTitle>
        </DialogHeader>

        <form id="location-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div
              role="alert"
              className="break-words rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400"
            >
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="location-name" className="text-xs font-semibold text-[var(--text-main)]">
              {t("library.locations.name")} *
            </label>
            <input
              id="location-name"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder={t("library.locations.name")}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="location-parent" className="text-xs font-semibold text-[var(--text-main)]">
              {t("library.locations.parent")}
            </label>
            <select
              id="location-parent"
              value={parentId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParentId(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t("library.itemDialog.noLocation")}</option>
              {flatList.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="location-description" className="text-xs font-semibold text-[var(--text-main)]">
              {t("library.itemDialog.description")}
            </label>
            <input
              id="location-description"
              type="text"
              maxLength={500}
              value={description}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              placeholder={t("library.itemDialog.description")}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </form>

        <DialogFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            {t("library.itemDialog.cancel")}
          </Button>
          <Button type="submit" form="location-form" size="sm" disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("library.itemDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
