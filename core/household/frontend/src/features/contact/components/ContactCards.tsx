'use client';

import { useTranslation } from '@/i18n';
import dynamic from 'next/dynamic';
import { Contact, ContactCategory } from '@/shared/types';
import { ContactCardItem } from './ContactCardItem';

const OSMMapViewer = dynamic(
  () => import('@alfheim/shared').then((mod) => mod.OSMMapViewer),
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
 * Popup text for a contact's map marker. The shared map renders both fields
 * as plain text, so contact data is passed unescaped.
 */
export function contactPopupText(c: Contact): { popupTitle: string; popupContent: string } {
  return {
    popupTitle: c.name,
    popupContent: [c.address, c.phone].filter(Boolean).join('\n'),
  };
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
  const categoryOf = (c: Contact) => categories.find((cat) => cat.id === c.category_id);

  if (isMapView) {
    const contactMarkers = contactList
      .filter((c) => c.latitude && c.longitude)
      .map((c) => ({
        id: c.id,
        lat: c.latitude!,
        lng: c.longitude!,
        ...contactPopupText(c),
        color: categoryOf(c)?.color || '#2563eb',
      }));
    return (
      <div className="h-[400px] w-full rounded-xl border border-[var(--border-subtle)] relative z-0 isolate overflow-hidden">
        <OSMMapViewer center={mapCenter} zoom={14} markers={contactMarkers} interactive={true} />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
      {contactList.length > 0 ? (
        contactList.map((c) => (
          <ContactCardItem
            key={c.id}
            contact={c}
            category={categoryOf(c)}
            isGuest={isGuest}
            onEdit={onEditContact}
            onDelete={onDeleteContact}
          />
        ))
      ) : (
        <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono bg-[var(--surface-elevated)] border border-dashed border-[var(--border-subtle)] rounded-xl">
          {t('household.no_contacts')}
        </div>
      )}
    </div>
  );
}
