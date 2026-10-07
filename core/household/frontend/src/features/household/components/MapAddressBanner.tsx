'use client';

import { useTranslation } from '@/i18n';
import dynamic from 'next/dynamic';
import { escapeHtml } from '@/lib/html';
import { Household } from '@/shared/types';

const OSMMapViewer = dynamic(
  () => import('@alfheim/shared').then((mod) => mod.OSMMapViewer),
  { ssr: false }
);

interface MapAddressBannerProps {
  household: Household;
  isOwnerOrAdmin: boolean;
  onUpdateAddressClick: () => void;
}

/**
 * Renders the household address details card alongside an interactive map preview.
 * If no address is set, collapses into a compact prompt banner to update address.
 */
export function MapAddressBanner({
  household,
  isOwnerOrAdmin,
  onUpdateAddressClick,
}: MapAddressBannerProps) {
  const { t } = useTranslation();

  // Collapsible UX prompt when no address is set
  if (!household.street) {
    return (
      <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shrink-0">
            <span className="material-symbols-outlined text-xl" aria-hidden="true">map</span>
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase text-[var(--text-muted)]">{t('household.address')}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{t('household.no_address')}</p>
          </div>
        </div>
        {isOwnerOrAdmin && (
          <button
            type="button"
            onClick={onUpdateAddressClick}
            className="px-4 py-2 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 rounded-lg text-xs font-mono text-[var(--text-main)] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">add_location</span>
            {t('household.save_address')}
          </button>
        )}
      </div>
    );
  }

  const hasGeocodedAddress = household.latitude && household.longitude;
  const mapCenter: [number, number] = hasGeocodedAddress
    ? [household.latitude!, household.longitude!]
    : [52.520008, 13.404954]; // Fallback Berlin center

  return (
    <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Address Info Panel */}
      <div className="lg:col-span-4 min-w-0 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h2 className="text-xs font-mono uppercase text-[var(--text-muted)] flex items-center gap-1">
            <span className="material-symbols-outlined text-base text-[var(--primary-main)]" aria-hidden="true">pin_drop</span>
            {t('household.address')}
          </h2>
          <div className="space-y-1 font-sans text-xs text-[var(--text-main)] leading-relaxed wrap-anywhere">
            <p className="font-semibold text-sm">{household.street}</p>
            <p>
              {household.zip} {household.city}
            </p>
            <p className="text-[var(--text-muted)]">{household.country}</p>
            {hasGeocodedAddress && (
              <p className="text-[10px] font-mono text-[var(--text-muted)] mt-2">
                {t('household_app.address.coordinates', {
                  lat: household.latitude?.toFixed(5) ?? '',
                  lng: household.longitude?.toFixed(5) ?? '',
                })}
              </p>
            )}
          </div>
        </div>

        {isOwnerOrAdmin && (
          <button
            type="button"
            onClick={onUpdateAddressClick}
            className="w-full py-2 bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 rounded-lg text-xs font-mono text-[var(--text-main)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">edit_location</span>
            {t('household.save_address')}
          </button>
        )}
      </div>

      {/* Map Viewer Stacking Isolated Container */}
      <div className="lg:col-span-8 h-60 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] relative z-0 isolate overflow-hidden">
        <OSMMapViewer
          center={mapCenter}
          zoom={hasGeocodedAddress ? 15 : 12}
          markers={
            hasGeocodedAddress
              ? [{ id: 'household', lat: mapCenter[0], lng: mapCenter[1], popupContent: escapeHtml(household.name) }]
              : []
          }
          interactive={false}
        />
      </div>
    </div>
  );
}
