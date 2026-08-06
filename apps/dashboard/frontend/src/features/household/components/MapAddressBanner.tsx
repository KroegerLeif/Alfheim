'use client';

import { useTranslation } from '@loeger-os/shared';
import dynamic from 'next/dynamic';
import { Household } from '@/shared/types';

const OSMMapViewer = dynamic(
  () => import('@loeger-os/shared').then((mod) => mod.OSMMapViewer),
  { ssr: false }
);

interface MapAddressBannerProps {
  household: Household;
  isOwnerOrAdmin: boolean;
  onUpdateAddressClick: () => void;
}

/**
 * Renders the household address details card alongside an interactive map preview.
 */
export function MapAddressBanner({
  household,
  isOwnerOrAdmin,
  onUpdateAddressClick,
}: MapAddressBannerProps) {
  const { t } = useTranslation();
  
  const hasGeocodedAddress = household.latitude && household.longitude;
  const mapCenter: [number, number] = hasGeocodedAddress
    ? [household.latitude!, household.longitude!]
    : [52.520008, 13.404954]; // Fallback Berlin center

  return (
    <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Address Info Panel */}
      <div className="lg:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h2 className="text-xs font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
            <span className="material-symbols-outlined text-base text-[var(--primary-main)]">pin_drop</span>
            {t('household.address')}
          </h2>
          {household.street ? (
            <div className="space-y-1 font-sans text-xs text-[var(--text-main)] leading-relaxed">
              <p className="font-semibold text-sm">{household.street}</p>
              <p>
                {household.zip} {household.city}
              </p>
              <p className="text-[var(--text-muted)]">{household.country}</p>
              {hasGeocodedAddress && (
                <p className="text-[10px] font-mono text-[var(--text-muted)] mt-2">
                  Lat: {household.latitude?.toFixed(5)} • Lng: {household.longitude?.toFixed(5)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic font-sans">
              No address registered. Update household settings.
            </p>
          )}
        </div>

        {isOwnerOrAdmin && (
          <button
            onClick={onUpdateAddressClick}
            className="w-full py-2 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 rounded-lg text-xs font-mono text-[var(--text-main)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">edit_location</span>
            {t('household.save_address')}
          </button>
        )}
      </div>

      {/* Map Viewer Container */}
      <div className="lg:col-span-8 h-60 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] relative overflow-hidden">
        <OSMMapViewer
          center={mapCenter}
          zoom={hasGeocodedAddress ? 15 : 12}
          markers={
            hasGeocodedAddress
              ? [{ id: 'household', lat: mapCenter[0], lng: mapCenter[1], popupContent: household.name }]
              : []
          }
          interactive={false}
        />
      </div>
    </div>
  );
}
