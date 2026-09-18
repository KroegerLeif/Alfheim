'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation, AddressAutocomplete, Dialog, DialogContent, DialogTitle } from '@alfheim/shared';
import { Household } from '@/shared/types';

const OSMMapViewer = dynamic(
  () => import('@alfheim/shared').then((mod) => mod.OSMMapViewer),
  { ssr: false }
);

interface AddressManagementModalProps {
  isOpen: boolean;
  household: Household;
  onClose: () => void;
  onAddressSelect: (addr: any) => void;
}

/**
 * Modal component for searching household addresses with OpenStreetMap preview and autocomplete.
 */
export function AddressManagementModal({
  isOpen,
  household,
  onClose,
  onAddressSelect,
}: AddressManagementModalProps) {
  const { t } = useTranslation();
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null);

  if (!isOpen) return null;

  const handleSelect = (addr: any) => {
    if (addr && addr.lat && addr.lng) {
      setSelectedCoords([addr.lat, addr.lng]);
    }
    onAddressSelect(addr);
  };

  const currentCoords: [number, number] = household.latitude && household.longitude
    ? [household.latitude, household.longitude]
    : [52.520008, 13.404954]; // Fallback Berlin center

  const mapCenter = selectedCoords || currentCoords;
  const hasCoords = selectedCoords !== null || (household.latitude !== undefined && household.longitude !== undefined);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-lg">
        <DialogTitle className="text-base font-bold text-[var(--text-main)]">{t('household.address_search')}</DialogTitle>

        <div className="space-y-4">
          <AddressAutocomplete placeholder={t('household.address_search')} onSelect={handleSelect} />

          <div className="h-48 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] overflow-hidden relative isolate">
            <OSMMapViewer
              center={mapCenter}
              zoom={hasCoords ? 15 : 12}
              markers={
                hasCoords
                  ? [{ id: 'household-address', lat: mapCenter[0], lng: mapCenter[1], popupContent: household.name }]
                  : []
              }
              interactive={false}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
