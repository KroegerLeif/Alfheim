'use client';

import { useState, useEffect } from 'react';
import { useTranslation, Dialog, DialogContent, DialogTitle } from '@alfheim/shared';
import { Contact, ContactCategory } from '@/shared/types';
import { ContactModalFormFields } from './ContactModalFormFields';

interface ContactModalProps {
  isOpen: boolean;
  editingContact: Contact | null;
  categories: ContactCategory[];
  onClose: () => void;
  onSubmit: (payload: {
    category_id: string | null;
    name: string;
    phone: string;
    email: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    description: string;
    links: string[];
    icon: string;
    avatar_url: string;
  }) => void;
}

export function ContactModal({
  isOpen,
  editingContact,
  categories,
  onClose,
  onSubmit,
}: ContactModalProps) {
  const { t } = useTranslation();

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactLat, setContactLat] = useState<number | null>(null);
  const [contactLng, setContactLng] = useState<number | null>(null);
  const [contactDesc, setContactDesc] = useState('');
  const [contactLinks, setContactLinks] = useState('');
  const [contactCatId, setContactCatId] = useState('');
  const [contactIcon, setContactIcon] = useState('person');
  const [contactAvatarUrl, setContactAvatarUrl] = useState('');

  useEffect(() => {
    if (editingContact) {
      setContactName(editingContact.name);
      setContactPhone(editingContact.phone);
      setContactEmail(editingContact.email);
      setContactAddress(editingContact.address);
      setContactLat(editingContact.latitude || null);
      setContactLng(editingContact.longitude || null);
      setContactDesc(editingContact.description);
      setContactLinks((editingContact.links ?? []).join('\n'));
      setContactCatId(editingContact.category_id || '');
      setContactIcon(editingContact.icon || 'person');
      setContactAvatarUrl(editingContact.avatar_url || '');
    } else {
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setContactAddress('');
      setContactLat(null);
      setContactLng(null);
      setContactDesc('');
      setContactLinks('');
      setContactCatId('');
      setContactIcon('person');
      setContactAvatarUrl('');
    }
  }, [editingContact]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    onSubmit({
      category_id: contactCatId || null,
      name: contactName.trim(),
      phone: contactPhone.trim(),
      email: contactEmail.trim(),
      address: contactAddress.trim(),
      latitude: contactLat,
      longitude: contactLng,
      description: contactDesc.trim(),
      links: contactLinks
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      icon: contactIcon,
      avatar_url: contactAvatarUrl.trim(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-base font-bold text-[var(--text-main)]">
          {editingContact ? t('household.edit_contact') : t('household.add_contact')}
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ContactModalFormFields
            categories={categories}
            contactName={contactName}
            setContactName={setContactName}
            contactCatId={contactCatId}
            setContactCatId={setContactCatId}
            contactPhone={contactPhone}
            setContactPhone={setContactPhone}
            contactEmail={contactEmail}
            setContactEmail={setContactEmail}
            contactAddress={contactAddress}
            setContactAddress={setContactAddress}
            contactLat={contactLat}
            setContactLat={setContactLat}
            contactLng={contactLng}
            setContactLng={setContactLng}
            contactIcon={contactIcon}
            setContactIcon={setContactIcon}
            contactAvatarUrl={contactAvatarUrl}
            setContactAvatarUrl={setContactAvatarUrl}
            contactDesc={contactDesc}
            setContactDesc={setContactDesc}
            contactLinks={contactLinks}
            setContactLinks={setContactLinks}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer"
            >
              {t('household.save_contact')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
