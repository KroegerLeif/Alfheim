'use client';

import { useState, useEffect } from 'react';
import { useTranslation, AddressAutocomplete } from '@alfheim/shared';
import { Contact, ContactCategory } from '@/shared/types';

interface ContactModalProps {
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

/**
 * Modal dialog for contact record creation and editing.
 */
export function ContactModal({
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
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-base font-bold text-[var(--text-main)]">
            {editingContact ? t('household.edit_contact') : t('household.add_contact')}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                {t('household.name')} *
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Leif Kröger"
                className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                {t('household.category')}
              </label>
              <select
                value={contactCatId}
                onChange={(e) => setContactCatId(e.target.value)}
                className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] cursor-pointer"
              >
                <option value="">{t('household.none')}</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                {t('household.phone')}
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. +49 123 45678"
                className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                {t('household.email')}
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. contact@domain.com"
                className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              {t('household.address')} (Geocoded lookup)
            </label>
            <AddressAutocomplete
              placeholder="Search address for map plotting..."
              initialValue={contactAddress}
              onSelect={(addr) => {
                setContactAddress(addr.display_name);
                setContactLat(addr.lat);
                setContactLng(addr.lng);
              }}
            />
            {contactLat && contactLng && (
              <p className="text-[10px] font-mono text-[var(--text-muted)] mt-1.5">
                Geocoded location resolved: {contactLat.toFixed(5)}, {contactLng.toFixed(5)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                {t('common.select_icon')}
              </label>
              <select
                value={contactIcon}
                onChange={(e) => setContactIcon(e.target.value)}
                className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] cursor-pointer"
              >
                <option value="person">{t('dashboard.contact.categories.person')}</option>
                <option value="call">{t('dashboard.contact.categories.call')}</option>
                <option value="local_police">{t('dashboard.contact.categories.police')}</option>
                <option value="medical_services">{t('dashboard.contact.categories.doctor')}</option>
                <option value="handyman">{t('dashboard.contact.categories.handyman')}</option>
                <option value="business">{t('dashboard.contact.categories.business')}</option>
                <option value="star">{t('dashboard.contact.categories.important')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                {t('profile.avatar_url')}
              </label>
              <input
                type="url"
                value={contactAvatarUrl}
                onChange={(e) => setContactAvatarUrl(e.target.value)}
                placeholder="e.g. https://domain.com/image.jpg"
                className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              {t('household.description')}
            </label>
            <textarea
              value={contactDesc}
              onChange={(e) => setContactDesc(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              {t('household.links')}
            </label>
            <textarea
              value={contactLinks}
              onChange={(e) => setContactLinks(e.target.value)}
              placeholder="e.g. https://website.com"
              rows={2}
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
            />
          </div>

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
      </div>
    </div>
  );
}
