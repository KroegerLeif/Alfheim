'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@alfheim/shared';

import { HouseholdHeader } from './HouseholdHeader';
import { MapAddressBanner } from './MapAddressBanner';
import { MemberTable } from './MemberTable';
import { HouseholdDetailSkeleton } from './HouseholdDetailSkeleton';
import { HouseholdContactsSection } from './HouseholdContactsSection';
import { HouseholdModals } from './HouseholdModals';
import { useHouseholdContactActions } from '../hooks/useHouseholdContactActions';

import {
  useContacts, useCreateContact, useUpdateContact, useDeleteContact,
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
} from '@/features/contact';

import {
  useHousehold, useCreateInvite, useUpdateHouseholdAddress,
  useUpdateMemberRole, useRemoveMember,
} from '../hooks/queries';

import { InviteCodeResponse, Contact, ContactCategory } from '@/shared/types';

interface HouseholdDetailViewProps {
  householdId: string;
}

export function HouseholdDetailView({ householdId }: HouseholdDetailViewProps) {
  const { t } = useTranslation();

  const { data: household, isLoading: isHhLoading } = useHousehold(householdId);
  const { data: contactsData, isLoading: isContactsLoading } = useContacts(householdId);
  const { data: categoriesData } = useCategories(householdId);

  const contacts = contactsData ?? [];
  const categories = categoriesData ?? [];

  const createInviteMutation = useCreateInvite();
  const updateAddressMutation = useUpdateHouseholdAddress();
  const updateMemberRoleMutation = useUpdateMemberRole(householdId);
  const removeMemberMutation = useRemoveMember(householdId);

  const createContactMutation = useCreateContact(householdId);
  const updateContactMutation = useUpdateContact(householdId);
  const deleteContactMutation = useDeleteContact(householdId);

  const createCategoryMutation = useCreateCategory(householdId);
  const updateCategoryMutation = useUpdateCategory(householdId);
  const deleteCategoryMutation = useDeleteCategory(householdId);

  const [activeInvite, setActiveInvite] = useState<InviteCodeResponse | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ContactCategory | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isMapView, setIsMapView] = useState(false);

  const {
    openCategoryModal, handleCategorySubmit, handleDeleteCategory,
    openContactModal, handleContactSubmit, handleDeleteContact,
  } = useHouseholdContactActions(
    editingCategory, setIsCategoryModalOpen, setEditingCategory,
    createCategoryMutation, updateCategoryMutation, deleteCategoryMutation,
    editingContact, setIsContactModalOpen, setEditingContact,
    createContactMutation, updateContactMutation, deleteContactMutation, t
  );

  useEffect(() => {
    if (householdId) {
      localStorage.setItem('alfheim_active_household_id', householdId);
      if (household) {
        localStorage.setItem('alfheim_active_household_role', household.role || 'MEMBER');
      }
      window.dispatchEvent(new Event('storage-household-changed'));
    }
  }, [householdId, household]);

  if (isHhLoading || isContactsLoading) return <HouseholdDetailSkeleton />;

  if (!household) {
    return (
      <div className="col-span-12 flex flex-col items-center justify-center p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 min-h-[40vh]">
        <span className="material-symbols-outlined text-4xl text-[var(--text-muted)]">error</span>
        <h3 className="text-lg font-bold text-[var(--text-main)]">{t('household.not_found')}</h3>
        <p className="text-xs text-[var(--text-muted)]">{t('household.not_found_desc')}</p>
        <Link href="/household" className="px-4 py-2 bg-[var(--primary-main)] text-slate-950 rounded-lg text-xs font-bold font-mono hover:bg-[var(--primary-hover)] transition-colors">
          {t('household.back_to_list')}
        </Link>
      </div>
    );
  }

  const activeRole = (household.role || 'MEMBER').toUpperCase();
  const isOwnerOrAdmin = activeRole === 'OWNER' || activeRole === 'ADMIN';
  const isGuest = activeRole === 'GUEST';

  const mapCenter: [number, number] = household.latitude && household.longitude
    ? [household.latitude, household.longitude]
    : [52.520008, 13.404954];

  const handleGenerateInvite = () => {
    createInviteMutation.mutate(
      { household_id: household.id, role: 'MEMBER', ttl_minutes: 60, max_uses: 5 },
      { onSuccess: (data) => setActiveInvite(data) }
    );
  };

  const handleAddressSelect = (addr: any) => {
    updateAddressMutation.mutate(
      {
        householdId: household.id,
        payload: {
          street: addr.street, zip: addr.zip, city: addr.city,
          country: addr.country, latitude: addr.lat, longitude: addr.lng,
        },
      },
      { onSuccess: () => setIsAddressModalOpen(false) }
    );
  };

  const handleRoleChange = (userId: string, currentRole: string, newRole: string) => {
    if (currentRole === 'OWNER') return;
    updateMemberRoleMutation.mutate({ userId, role: newRole });
  };

  const handleRemoveMemberClick = (userId: string, displayName: string) => {
    if (confirm(`${t('household.confirm_remove')} (${displayName})`)) {
      removeMemberMutation.mutate(userId);
    }
  };

  return (
    <>
      <HouseholdHeader household={household} isOwnerOrAdmin={isOwnerOrAdmin} onGenerateInvite={handleGenerateInvite} />
      <MapAddressBanner household={household} isOwnerOrAdmin={isOwnerOrAdmin} onUpdateAddressClick={() => setIsAddressModalOpen(true)} />

      <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
        <MemberTable household={household} isOwnerOrAdmin={isOwnerOrAdmin} onRoleChange={handleRoleChange} onRemoveMember={handleRemoveMemberClick} />
        <HouseholdContactsSection
          contacts={contacts} categories={categories} isMapView={isMapView} setIsMapView={setIsMapView}
          isGuest={isGuest} mapCenter={mapCenter} onOpenCategoryModal={openCategoryModal}
          onDeleteCategory={handleDeleteCategory} onOpenContactModal={openContactModal} onDeleteContact={handleDeleteContact}
        />
      </div>

      <HouseholdModals
        activeInvite={activeInvite} setActiveInvite={setActiveInvite} isAddressModalOpen={isAddressModalOpen}
        setIsAddressModalOpen={setIsAddressModalOpen} household={household} handleAddressSelect={handleAddressSelect}
        isCategoryModalOpen={isCategoryModalOpen} setIsCategoryModalOpen={setIsCategoryModalOpen}
        editingCategory={editingCategory} handleCategorySubmit={handleCategorySubmit}
        isContactModalOpen={isContactModalOpen} setIsContactModalOpen={setIsContactModalOpen}
        editingContact={editingContact} categories={categories} handleContactSubmit={handleContactSubmit}
      />
    </>
  );
}
