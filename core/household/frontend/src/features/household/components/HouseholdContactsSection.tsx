'use client';

import { useTranslation } from '@alfheim/shared';
import { ContactCards, CategoryManager } from '@/features/contact';
import { Contact, ContactCategory } from '@/shared/types';

interface HouseholdContactsSectionProps {
  contacts: Contact[];
  categories: ContactCategory[];
  isMapView: boolean;
  setIsMapView: (val: boolean) => void;
  isGuest: boolean;
  mapCenter: [number, number];
  onOpenCategoryModal: (cat?: ContactCategory | null) => void;
  onDeleteCategory: (catId: string) => void;
  onOpenContactModal: (c?: Contact | null) => void;
  onDeleteContact: (contactId: string) => void;
}

export function HouseholdContactsSection({
  contacts,
  categories,
  isMapView,
  setIsMapView,
  isGuest,
  mapCenter,
  onOpenCategoryModal,
  onDeleteCategory,
  onOpenContactModal,
  onDeleteContact,
}: HouseholdContactsSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="lg:col-span-7 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-mono uppercase tracking-wide text-[var(--text-muted)]">
              {t('household.contacts')}
            </h2>
            <button
              onClick={() => setIsMapView(!isMapView)}
              className="px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] hover:border-[var(--primary-main)]/50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[12px]">{isMapView ? 'list' : 'map'}</span>
              <span>{isMapView ? t('household.list_view') : t('household.map_view')}</span>
            </button>
          </div>

          {!isGuest && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onOpenCategoryModal()}
                className="px-2 py-1 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] flex items-center gap-1 hover:border-[var(--primary-main)]/40 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">folder_open</span>
                {t('household.add_category')}
              </button>
              <button
                onClick={() => onOpenContactModal()}
                className="px-2.5 py-1 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-[10px] flex items-center gap-1 hover:bg-[var(--primary-hover)] cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">person_add</span>
                {t('household.add_contact')}
              </button>
            </div>
          )}
        </div>

        <CategoryManager
          categories={categories}
          isGuest={isGuest}
          onEditCategory={onOpenCategoryModal}
          onDeleteCategory={onDeleteCategory}
        />

        <ContactCards
          contacts={contacts}
          categories={categories}
          isMapView={isMapView}
          isGuest={isGuest}
          mapCenter={mapCenter}
          onEditContact={onOpenContactModal}
          onDeleteContact={onDeleteContact}
        />
      </div>
    </div>
  );
}
