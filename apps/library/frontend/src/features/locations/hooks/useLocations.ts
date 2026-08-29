import { useCallback, useEffect, useState } from "react";
import {
  createLocation,
  deleteLocation,
  fetchLocationsTree,
  updateLocation,
} from "../api/locationsApi";
import type {
  LocationCreatePayload,
  LocationNode,
  LocationUpdatePayload,
} from "../types";

export function useLocations() {
  const [locations, setLocations] = useState<LocationNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formModalState, setFormModalState] = useState<{
    isOpen: boolean;
    locationToEdit: LocationNode | null;
    defaultParentId: string | null;
  }>({ isOpen: false, locationToEdit: null, defaultParentId: null });

  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    locationToDelete: LocationNode | null;
  }>({ isOpen: false, locationToDelete: null });

  const loadLocations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const treeData = await fetchLocationsTree();
      setLocations(treeData);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load locations."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLocations();
  }, [loadLocations]);

  const handleCreate = async (payload: LocationCreatePayload) => {
    await createLocation(payload);
    await loadLocations();
  };

  const handleUpdate = async (id: string, payload: LocationUpdatePayload) => {
    await updateLocation(id, payload);
    await loadLocations();
  };

  const handleDelete = async (id: string) => {
    await deleteLocation(id);
    await loadLocations();
  };

  const openCreateModal = (parentId: string | null = null) => {
    setFormModalState({
      isOpen: true,
      locationToEdit: null,
      defaultParentId: parentId,
    });
  };

  const openEditModal = (location: LocationNode) => {
    setFormModalState({
      isOpen: true,
      locationToEdit: location,
      defaultParentId: null,
    });
  };

  const closeFormModal = () => {
    setFormModalState({
      isOpen: false,
      locationToEdit: null,
      defaultParentId: null,
    });
  };

  const openDeleteModal = (location: LocationNode) => {
    setDeleteModalState({ isOpen: true, locationToDelete: location });
  };

  const closeDeleteModal = () => {
    setDeleteModalState({ isOpen: false, locationToDelete: null });
  };

  return {
    locations,
    isLoading,
    error,
    loadLocations,
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
  };
}
