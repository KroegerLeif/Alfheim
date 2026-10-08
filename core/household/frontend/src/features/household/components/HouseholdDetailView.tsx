'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';

import { HouseholdHeader } from './HouseholdHeader';
import { MapAddressBanner } from './MapAddressBanner';
import { MemberTable } from './MemberTable';
import { HouseholdDetailSkeleton } from './HouseholdDetailSkeleton';
import { HouseholdLoadError } from './HouseholdLoadError';
import { HouseholdContactsSection } from './HouseholdContactsSection';
import { HouseholdModals } from './HouseholdModals';
import { InviteList } from './InviteList';
import { HouseholdSettingsPanel } from './HouseholdSettingsPanel';
import { StatusBanner } from './StatusBanner';
import { useHouseholdContactActions } from '../hooks/useHouseholdContactActions';
import { getHouseholdPermissions } from '../permissions';

import {
  useContacts, useCreateContact, useUpdateContact, useDeleteContact,
  useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
} from '@/features/contact';

import {
  useHousehold, useHouseholds, useCreateInvite, useUpdateHouseholdAddress,
  useUpdateMemberRole, useRemoveMember,
} from '../hooks/queries';

import type { AddressResult } from '@alfheim/shared';
import { InviteCodeResponse, Contact, ContactCategory } from '@/shared/types';
import { describeApiError } from '@/lib/apiErrors';
import { setActiveHousehold, replaceActiveHousehold } from '@/lib/activeHousehold';
import { APP_ROUTES } from '@/lib/routes';

interface HouseholdDetailViewProps {
  householdId: string;
}

export function HouseholdDetailView({ householdId }: HouseholdDetailViewProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const { data: household, isLoading: isHhLoading, error: householdError } = useHousehold(householdId);
  const { data: households } = useHouseholds();
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
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    openCategoryModal, handleCategorySubmit, handleDeleteCategory,
    openContactModal, handleContactSubmit, handleDeleteContact,
  } = useHouseholdContactActions(
    editingCategory, setIsCategoryModalOpen, setEditingCategory,
    createCategoryMutation, updateCategoryMutation, deleteCategoryMutation,
    editingContact, setIsContactModalOpen, setEditingContact,
    createContactMutation, updateContactMutation, deleteContactMutation, t
  );

  // Opening a household makes it the active one for every Alfheim app.
  const loadedId = household?.id;
  useEffect(() => {
    if (loadedId) setActiveHousehold(loadedId);
  }, [loadedId]);

  // Surface failed contact/category mutations instead of failing silently.
  const contactMutationError =
    createContactMutation.error ?? updateContactMutation.error ?? deleteContactMutation.error ??
    createCategoryMutation.error ?? updateCategoryMutation.error ?? deleteCategoryMutation.error;

  if (isHhLoading || isContactsLoading) return <HouseholdDetailSkeleton />;

  if (!household) return <HouseholdLoadError error={householdError} />;

  const permissions = getHouseholdPermissions(household.role);
  const isDefault =
    household.is_default ?? households?.find((h) => h.id === household.id)?.is_default ?? false;

  const mapCenter: [number, number] = household.latitude && household.longitude
    ? [household.latitude, household.longitude]
    : [52.520008, 13.404954];

  const onActionError = (err: unknown) => setActionError(describeApiError(err, t));

  const handleGenerateInvite = () => {
    setActionError(null);
    createInviteMutation.mutate(
      { household_id: household.id, role: 'MEMBER', ttl_minutes: 60, max_uses: 5 },
      { onSuccess: (data) => setActiveInvite(data), onError: onActionError }
    );
  };

  const handleAddressSelect = (addr: AddressResult) => {
    setActionError(null);
    updateAddressMutation.mutate(
      {
        householdId: household.id,
        payload: {
          street: addr.street, zip: addr.zip, city: addr.city,
          country: addr.country, latitude: addr.lat, longitude: addr.lng,
        },
      },
      { onSuccess: () => setIsAddressModalOpen(false), onError: onActionError }
    );
  };

  const handleRoleChange = (userId: string, currentRole: string, newRole: string) => {
    if (currentRole === 'OWNER') return;
    setActionError(null);
    updateMemberRoleMutation.mutate({ userId, role: newRole }, { onError: onActionError });
  };

  const handleRemoveMemberClick = (userId: string, displayName: string) => {
    if (confirm(t('household_app.members.confirm_remove', { name: displayName }))) {
      setActionError(null);
      removeMemberMutation.mutate(userId, { onError: onActionError });
    }
  };

  const handleRemoved = () => {
    const fallback = households?.find((h) => h.id !== household.id && h.is_default)
      ?? households?.find((h) => h.id !== household.id);
    replaceActiveHousehold(household.id, fallback?.id);
    router.replace(fallback ? APP_ROUTES.list : APP_ROUTES.onboarding);
  };

  return (
    <>
      <HouseholdHeader household={household} isOwnerOrAdmin={permissions.canManageInvites} onGenerateInvite={handleGenerateInvite} />

      {(actionError || contactMutationError) && (
        <div className="col-span-12">
          <StatusBanner kind="error">{actionError ?? describeApiError(contactMutationError, t)}</StatusBanner>
        </div>
      )}

      <MapAddressBanner household={household} isOwnerOrAdmin={permissions.canEditAddress} onUpdateAddressClick={() => setIsAddressModalOpen(true)} />

      <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
        <MemberTable household={household} isOwnerOrAdmin={permissions.canManageMembers} onRoleChange={handleRoleChange} onRemoveMember={handleRemoveMemberClick} />
        <HouseholdContactsSection
          contacts={contacts} categories={categories} isMapView={isMapView} setIsMapView={setIsMapView}
          isGuest={!permissions.canEditContacts} mapCenter={mapCenter} onOpenCategoryModal={openCategoryModal}
          onDeleteCategory={handleDeleteCategory} onOpenContactModal={openContactModal} onDeleteContact={handleDeleteContact}
        />
      </div>

      {permissions.canManageInvites && (
        <div className="col-span-12">
          <InviteList householdId={household.id} onShowInvite={setActiveInvite} />
        </div>
      )}

      <div className="col-span-12">
        <HouseholdSettingsPanel
          household={household}
          permissions={permissions}
          isDefault={isDefault}
          onRemoved={handleRemoved}
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
