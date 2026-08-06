'use client';

import { useTranslation } from '@loeger-os/shared';
import dynamic from 'next/dynamic';
import { Contact, ContactCategory } from '@/shared/types';

const OSMMapViewer = dynamic(
  () => import('@loeger-os/shared').then((mod) => mod.OSMMapViewer),
  { ssr: false }
);

interface ContactCardsProps {
  contacts: Contact[];
  categories: ContactCategory[];
  isMapView: boolean;
  isGuest: boolean;
  mapCenter: [number, number];
  onEditContact: (contact: Contact) => void;
  onDeleteContact: (contactId: string) => void;
}

/**
 * Renders contact records either as a list of detailed cards or mapped pinpoints.
 */
export function ContactCards({
  contacts,
  categories,
  isMapView,
  isGuest,
  mapCenter,
  onEditContact,
  onDeleteContact,
}: ContactCardsProps) {
  const { t } = useTranslation();
  const contactList = contacts ?? [];

  const contactMarkers = contactList
    .filter((c) => c.latitude && c.longitude)
    .map((c) => {
      const cat = categories.find((cat) => cat.id === c.category_id);
      return {
        id: c.id,
        lat: c.latitude!,
        lng: c.longitude!,
        popupContent: `<strong>${c.name}</strong><br/>${c.address || ''}<br/>${c.phone || ''}`,
        color: cat?.color || '#2563eb',
      };
    });

  if (isMapView) {
    return (
      <div className="h-[400px] w-full rounded-xl border border-[var(--border-subtle)] relative z-0 isolate overflow-hidden">
        <OSMMapViewer center={mapCenter} zoom={14} markers={contactMarkers} interactive={true} />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
      {contactList.length > 0 ? (
        contactList.map((c) => {
          const cat = categories.find((cat) => cat.id === c.category_id);
          const links = c.links ?? [];
          const avatar = c.avatar_url;
          const icon = c.icon || cat?.icon || 'person';

          return (
            <div
              key={c.id}
              className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-colors duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Visual Avatar / Icon Badge */}
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 overflow-hidden">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={c.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Hide broken image to let fallback show or display default icon
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span
                      className="material-symbols-outlined text-lg"
                      style={{ color: cat?.color || 'var(--text-muted)' }}
                    >
                      {icon}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[var(--text-main)] text-sm truncate">{c.name}</span>
                    {cat && (
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border"
                        style={{
                          borderColor: `${cat.color}40`,
                          backgroundColor: `${cat.color}10`,
                          color: cat.color,
                        }}
                      >
                        {cat.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--text-muted)] font-sans">{c.description}</p>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1">
                    {c.phone && (
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs">phone</span>
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs">mail</span>
                        {c.email}
                      </span>
                    )}
                    {c.address && (
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-xs">map</span>
                        {c.address}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {c.phone && (
                  <a
                    href={`tel:${c.phone}`}
                    className="p-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] cursor-pointer inline-flex items-center"
                  >
                    <span className="material-symbols-outlined text-sm">call</span>
                  </a>
                )}
                {c.email && (
                  <a
                    href={`mailto:${c.email}`}
                    className="p-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] cursor-pointer inline-flex items-center"
                  >
                    <span className="material-symbols-outlined text-sm">mail</span>
                  </a>
                )}
                {links.length > 0 && (
                  <a
                    href={links[0]}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] cursor-pointer inline-flex items-center"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </a>
                )}

                {!isGuest && (
                  <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-1.5 ml-1">
                    <button
                      onClick={() => onEditContact(c)}
                      className="p-2 rounded hover:bg-[var(--surface-canvas)] text-[var(--text-main)] cursor-pointer inline-flex items-center"
                    >
                      <span className="material-symbols-outlined text-sm text-[var(--text-muted)] hover:text-[var(--text-main)]">
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => onDeleteContact(c.id)}
                      className="p-2 rounded hover:bg-[var(--surface-canvas)] text-red-400 hover:text-red-300 cursor-pointer inline-flex items-center"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono bg-[var(--surface-elevated)] border border-dashed border-[var(--border-subtle)] rounded-xl">
          {t('household.no_contacts')}
        </div>
      )}
    </div>
  );
}
