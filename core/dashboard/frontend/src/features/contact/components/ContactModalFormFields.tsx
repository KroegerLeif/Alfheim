'use client';

import { useTranslation, AddressAutocomplete } from '@alfheim/shared';
import { ContactCategory } from '@/shared/types';

interface ContactModalFormFieldsProps {
  categories: ContactCategory[];
  contactName: string;
  setContactName: (val: string) => void;
  contactCatId: string;
  setContactCatId: (val: string) => void;
  contactPhone: string;
  setContactPhone: (val: string) => void;
  contactEmail: string;
  setContactEmail: (val: string) => void;
  contactAddress: string;
  setContactAddress: (val: string) => void;
  contactLat: number | null;
  setContactLat: (val: number | null) => void;
  contactLng: number | null;
  setContactLng: (val: number | null) => void;
  contactIcon: string;
  setContactIcon: (val: string) => void;
  contactAvatarUrl: string;
  setContactAvatarUrl: (val: string) => void;
  contactDesc: string;
  setContactDesc: (val: string) => void;
  contactLinks: string;
  setContactLinks: (val: string) => void;
}

export function ContactModalFormFields({
  categories, contactName, setContactName, contactCatId, setContactCatId,
  contactPhone, setContactPhone, contactEmail, setContactEmail,
  contactAddress, setContactAddress, contactLat, setContactLat, contactLng, setContactLng,
  contactIcon, setContactIcon, contactAvatarUrl, setContactAvatarUrl,
  contactDesc, setContactDesc, contactLinks, setContactLinks,
}: ContactModalFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
            {t('household.name')} *
          </label>
          <input
            type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
            placeholder="e.g. Leif Kröger" required
            className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
          />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
            {t('household.category')}
          </label>
          <select
            value={contactCatId} onChange={(e) => setContactCatId(e.target.value)}
            className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] cursor-pointer"
          >
            <option value="">{t('household.none')}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
            type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)}
            placeholder="e.g. +49 123 45678"
            className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
          />
        </div>
        <div>
          <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
            {t('household.email')}
          </label>
          <input
            type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
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
          placeholder="Search address for map plotting..." initialValue={contactAddress}
          onSelect={(addr) => {
            setContactAddress(addr.display_name); setContactLat(addr.lat); setContactLng(addr.lng);
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
            value={contactIcon} onChange={(e) => setContactIcon(e.target.value)}
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
            type="url" value={contactAvatarUrl} onChange={(e) => setContactAvatarUrl(e.target.value)}
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
          value={contactDesc} onChange={(e) => setContactDesc(e.target.value)}
          placeholder="Optional notes..." rows={2}
          className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
          {t('household.links')}
        </label>
        <textarea
          value={contactLinks} onChange={(e) => setContactLinks(e.target.value)}
          placeholder="e.g. https://website.com" rows={2}
          className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
        />
      </div>
    </>
  );
}
