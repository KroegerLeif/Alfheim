"use client";

import * as React from "react";
import {
  Button,
  EmptyState,
  Skeleton,
  Spinner,
  useTranslation,
} from "@alfheim/shared";
import { Dumbbell, Minus, Plus } from "lucide-react";
import { useDeleteEquipment, useEquipmentList } from "../hooks/useEquipment";
import type { EquipmentRead } from "../types";
import { EquipmentCard } from "./EquipmentCard";
import { EquipmentCreateForm } from "./EquipmentCreateForm";

/**
 * Orchestrates the equipment panel: create form toggle, loading/empty/error
 * states, and the card grid. Presentation lives in the child components.
 */
export function EquipmentListView() {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const { data, isLoading, isError } = useEquipmentList();
  const deleteMutation = useDeleteEquipment();

  const equipment = data ?? [];

  const handleDelete = (entry: EquipmentRead) => {
    setDeletingId(entry.id);
    deleteMutation.mutate(entry.id, {
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold uppercase tracking-wide">
            {t("workout.equipment")}
          </h2>
        </div>
        <Button
          variant="outline"
          className="min-h-11 self-start"
          onClick={() => setIsFormOpen((open) => !open)}
        >
          {isFormOpen ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {isFormOpen ? t("workout.cancel") : t("workout.createEquipment")}
        </Button>
      </div>

      {isFormOpen && (
        <EquipmentCreateForm
          onSuccess={() => setIsFormOpen(false)}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-xs font-bold uppercase text-red-400"
        >
          {t("workout.loadFailed")}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Spinner label={t("workout.loading")} className="mx-auto" />
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : equipment.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-8 w-8" />}
          title={t("workout.noEquipment")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {equipment.map((entry) => (
            <EquipmentCard
              key={entry.id}
              equipment={entry}
              onDelete={handleDelete}
              isDeleting={deletingId === entry.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
