"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import {
  LocationDeleteModal,
  LocationFormModal,
  LocationTreeView,
  useLocations,
} from "@/features/locations";

export default function LocationsPage() {
  const { t } = useTranslation();
  const {
    locations,
    isLoading,
    error,
    formModalState,
    deleteModalState,
    openCreateModal,
    openEditModal,
    closeFormModal,
    openDeleteModal,
    closeDeleteModal,
    handleCreate,
    handleUpdate,
    handleDelete,
  } = useLocations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-main,#f8fafc)]">
          {t("library.locations.title")}
        </h1>
        <p className="text-sm text-[var(--text-muted,#94a3b8)] mt-1">
          {t("library.locations.subtitle")}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <LocationTreeView
        locations={locations}
        isLoading={isLoading}
        onAddRootLocation={() => openCreateModal(null)}
        onAddChildLocation={(parentId) => openCreateModal(parentId)}
        onEditLocation={openEditModal}
        onDeleteLocation={openDeleteModal}
      />

      <LocationFormModal
        isOpen={formModalState.isOpen}
        onClose={closeFormModal}
        locationToEdit={formModalState.locationToEdit}
        defaultParentId={formModalState.defaultParentId}
        allLocations={locations}
        onSave={async (payload, id) => {
          if (id) {
            await handleUpdate(id, payload);
          } else {
            await handleCreate({
              name: payload.name ?? "",
              description: payload.description,
              parent_id: payload.parent_id,
            });
          }
        }}
      />

      <LocationDeleteModal
        isOpen={deleteModalState.isOpen}
        onClose={closeDeleteModal}
        locationToDelete={deleteModalState.locationToDelete}
        onConfirm={handleDelete}
      />
    </div>
  );
}
